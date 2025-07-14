import { v4 as uuidv4 } from 'uuid';
import { City, CityDetails } from '../../models/predefineSchemas.js';
import { Event, Adventure, Cuisine } from '../../models/EventsandCusines.js';
import Attraction from '../../models/Attraction.js';
import Route from '../../models/routeSchema.js';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import cloudinary from 'cloudinary';
import { setCache, getCache } from '../../utils/cache.js';
import { generateAIContent, fetchCityCoordinates } from '../../services/aiService.js';
import { getImageFromApis } from '../../services/imageServices.js';
import axios from 'axios';
import sharp from 'sharp';

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  timeout: 30000,
});

// In-memory cache for preview data and image uploads
const previewCache = new Map();
const PREVIEW_CACHE_TTL = 60 * 60 * 1000; // 1 hour
const ITEMS_CACHE_TTL = 24 * 60 * 60 * 1000; // 1 day
const IMAGE_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days for image URLs

// Simple rate limiter for Cloudinary uploads
const uploadQueue = [];
const MAX_CONCURRENT_UPLOADS = 5;
let activeUploads = 0;

// Compress image before uploading
const compressImage = async (buffer) => {
  try {
    return await sharp(buffer)
      .resize({ width: 1080, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
  } catch (error) {
    console.error(`Error compressing image: ${error.message}`);
    return buffer;
  }
};

// Upload image to Cloudinary with retries and rate limiting
const uploadImageToCloudinary = async (file, retries = 3, backoff = 1000) => {
  const cacheKey = `image:${file.fieldname}:${file.originalname}`;
  const cachedUrl = getCache(cacheKey);
  if (cachedUrl) {
    console.log(`Retrieved cached image URL for ${file.originalname}`);
    return cachedUrl;
  }

  const compressedBuffer = await compressImage(file.buffer);

  while (activeUploads >= MAX_CONCURRENT_UPLOADS) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  activeUploads += 1;
  try {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.v2.uploader.upload_stream(
            { folder: 'travel_items', resource_type: 'image' },
            (error, result) => (error ? reject(error) : resolve(result))
          );
          stream.end(compressedBuffer);
        });
        const imageUrl = result.secure_url;
        setCache(cacheKey, imageUrl, IMAGE_CACHE_TTL);
        console.log(`Successfully uploaded image ${file.originalname} to Cloudinary`);
        return imageUrl;
      } catch (error) {
        if (attempt === retries) throw error;
        console.warn(
          `Attempt ${attempt} failed for ${file.originalname}: ${error.message}. Retrying in ${backoff}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, backoff));
        backoff *= 2;
      }
    }
  } catch (error) {
    console.error(`Error uploading image to Cloudinary: ${error.message}`);
    throw new Error(`Failed to upload image ${file.originalname}: ${error.message}`);
  } finally {
    activeUploads -= 1;
  }
};

// Authentication middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};


const validTypes = ['attractions', 'events', 'adventures', 'cuisines', 'travelRoutes'];
const typeLimits = {
  attractions: 5,
  events: 3,
  adventures: 3,
  cuisines: 3,
  travelRoutes: 5,
};
const maxTokensPerType = {
  attractions: 1000,
  events: 200,
  adventures: 200,
  cuisines: 200,
  travelRoutes: 300,
};

const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/1080x720.png?text=No+Image+Available';


const buildPrompt = (cityName, types) => {
  const prompt = `
Act as a travel expert and return structured travel information in **valid JSON only**, no markdown, no extra text.

City: "${cityName}"

Structure:
{
  "cityDetails": {
    "coordinates": { "latitude": "decimal", "longitude": "decimal" },
"population": "Number (no underscores, no formatting — e.g., 20411274)",
    "description": "Short paragraph describing the city (under 50 words).",
    "topAttractions": [
      // Include up to 5 attractions
      { "name": "...", "description": "...", "category": "..." }
    ],
    "politicalContext": { "MLA": "...", "MP": "..." },
    "historicalImportance": "Short summary (under 100 words).",
    "notablePersonalities": ["..."],
    "popularFor": {
      "business": "...",
      "craft": "...",
      "events": "..."
    }
  },
  "items": {
    ${types.map(type => {
      if (type === 'travelRoutes') {
        return `"travelRoutes": [
          {
            "from": "...",
            "to": "...",
            "transports": [
              { "mode": "Train", "duration": "...", "details": "..." }
            ],
            "imageUrls": []
          }
          // Include up to 5 travel routes
        ]`;
      } else {
        return `"${type}": [
          {
            "name": "...",
            "description": "...",
            "category": "${type}",
            "imageUrls": []
          }
          // Include up to 5 items
        ]`;
      }
    }).join(',\n    ')}
  }
}

Ensure:
- Each object and array is **fully completed** (no cut-off fields).
- Do **not** truncate or cut off **mid-element** or **mid-array**.
- Only return **valid, compact, parsable JSON** (strict).
- Avoid trailing commas or invalid number formatting.
- Fit output within **1500 tokens** — **skip less important content if needed to stay within limit**.

`;

  return {
    prompt,
    maxTokens: 1500
  };
};




const validateImageUrls = async (urls = []) => {
  const valid = [];
  for (const url of urls) {
    try {
      const res = await axios.head(url, { timeout: 10000 });
      if (res.status === 200 && res.headers['content-type']?.startsWith('image/')) valid.push(url);
    } catch {}
  }
  return valid;
};

export const createCityItems = [
  authMiddleware,
  async (req, res) => {
    const { cityName, types, order } = req.body;
    if (!cityName || !Array.isArray(types) || types.length === 0) {
      return res.status(400).json({ error: 'City name and types array are required' });
    }
    if (!types.every((t) => validTypes.includes(t))) {
      return res.status(400).json({ error: 'Invalid types provided' });
    }

    let city = await City.findOne({ cityName });
    let cityDetailsDoc = null;
    let cityDetails = {};

    // Fetch coordinates first to ensure valid data
    const coords = await fetchCityCoordinates(cityName);
    

    const { prompt, maxTokens = 1000 } = buildPrompt(cityName, types); // Increased maxTokens to prevent truncation
    let aiResult = null;

    try {
      aiResult = await generateAIContent(prompt, { maxTokens, parseJson: true });
    } catch (err) {
      console.error(`AI content generation failed for "${cityName}":`, err.message, err.stack);
      return res.status(500).json({ error: 'Failed to generate AI city data', details: err.message });
    }

    if (!aiResult?.content || !aiResult.content.cityDetails) {
      console.error('AI content is null or malformed for "${cityName}":', JSON.stringify(aiResult, null, 2));
      return res.status(500).json({ error: 'Failed to generate valid AI city data' });
    }

    cityDetails = aiResult.content.cityDetails;

    // Ensure coordinates are valid; use fetched coords as fallback
    cityDetails.coordinates = cityDetails.coordinates || {};
    cityDetails.coordinates.latitude = Number(cityDetails.coordinates.latitude) || coords.latitude;
    cityDetails.coordinates.longitude = Number(cityDetails.coordinates.longitude) || coords.longitude;

    // Validate and clean description
    cityDetails.description = cityDetails.description?.trim() || `Description for ${cityName} not available.`;
    cityDetails.imageUrls = await validateImageUrls(cityDetails.imageUrls || []);

    if (!city) {
      city = await City.findOneAndUpdate(
        { cityName },
        { cityName, order, createdAt: Date.now() },
        { upsert: true, new: true }
      );
    }

    cityDetailsDoc = await CityDetails.findOne({ cityId: city._id });
    if (!cityDetailsDoc) {
      cityDetailsDoc = await CityDetails.create({
        cityId: city._id,
        ...cityDetails,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      city.cityDetails = cityDetailsDoc._id;
      await city.save();
    }

    const previewId = uuidv4();
    const previewData = { items: [], cityDetails, expiresAt: Date.now() + PREVIEW_CACHE_TTL };
    const files = req.files || [];

    const fileMap = files.reduce((acc, file) => {
      const match = file.fieldname.match(/^(.+)_image_(\d+)$/);
      if (match) {
        const itemName = match[1].replace(/_/g, ' ');
        acc[itemName] = acc[itemName] || [];
        acc[itemName].push(file);
      }
      return acc;
    }, {});

    const allItems = [];
    for (const type of types) {
      const items = aiResult.content.items[type] || [];
      items.slice(0, typeLimits[type]).forEach((item, index) => {
        const name = item.name?.trim() || `${cityName} ${type} ${index + 1}`; // Improved fallback name
        allItems.push({
          name,
          description: item.description?.trim() || 'No description.',
          category: item.category || type,
          city: cityName,
          cityId: city._id,
          images: item.imageUrls || [],
          rating: 0,
          type,
          tempId: `${type}_${index}_${uuidv4()}`,
          ...(type === 'travelRoutes' ? { from: item.from || '', to: item.to || cityName, transports: item.transports || [] } : {}),
        });
      });
    }

    const imageQueries = [];
    const itemsNeedingImages = [];
    for (const item of allItems) {
      const uploaded = fileMap[item.name] || [];
      if (uploaded.length > 0) {
        item.images = uploaded;
      } else {
        item.images = await validateImageUrls(item.images);
        if (item.images.length === 0) {
          imageQueries.push({ name: `${cityName} ${item.name}`, city: cityName, type: item.type, userId: req.user.id }); // Specific query
          itemsNeedingImages.push(item);
        }
      }
    }

    if (imageQueries.length > 0) {
      const results = await getImageFromApis(imageQueries);
      itemsNeedingImages.forEach((item, i) => {
        const result = results[i];
        item.images = result?.imageUrl ? [result.imageUrl] : [PLACEHOLDER_IMAGE];
      });
    }

    await Promise.all(
      allItems.map(async (item) => {
        if (Array.isArray(item.images) && item.images[0]?.buffer) {
          item.images = await Promise.all(item.images.map(uploadImageToCloudinary));
        }
      })
    );

    previewData.items = allItems;
    previewCache.set(previewId, previewData);
    setTimeout(() => previewCache.delete(previewId), PREVIEW_CACHE_TTL);

    res.status(200).json({ previewId, items: previewData.items, cityDetails });
  },
];
// Updated uploadImage endpoint
export const uploadImage = [
  authMiddleware,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
      }
      const imageUrl = await uploadImageToCloudinary(req.file);
      res.status(200).json({ secure_url: imageUrl });
    } catch (error) {
      console.error('Error uploading image:', error.message);
      res.status(500).json({ error: 'Failed to upload image', details: error.message });
    }
  },
];

// Confirm city items and save to database
export const confirmCityItems = [
  authMiddleware,
  async (req, res) => {
    try {
      const { previewId, items, cityProfile } = req.body;
      if (!previewId || !Array.isArray(items)) {
        return res.status(400).json({ error: 'Preview ID and items array are required' });
      }

      const previewData = previewCache.get(previewId);
      if (!previewData) {
        return res.status(404).json({ error: 'Preview data not found or expired' });
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        if (cityProfile) {
          const city = await City.findOne({ cityName: cityProfile.city }).session(session);
          if (city) {
            let cityDetailsDoc = await CityDetails.findOne({ cityId: city._id }).session(session);
            if (!cityDetailsDoc) {
              cityDetailsDoc = new CityDetails({
                cityId: city._id,
                coordinates: cityProfile.coordinates || { latitude: "0", longitude: "0" },
                country: cityProfile.country || "India",
                population: cityProfile.population || 0,
                description: cityProfile.historicalImportance || "",
                topAttractions: cityProfile.topAttractions || [],
                politicalContext: cityProfile.politicalContext || { MLA: "", MP: "" },
                historicalImportance: cityProfile.historicalImportance || "",
                notablePersonalities: cityProfile.notablePersonalities || [],
                popularFor: cityProfile.popularFor || { business: "", craft: "", events: "" },
                imageUrls: cityProfile.imageUrls || [],
                cityMap: cityProfile.cityMap || "",
                createdAt: Date.now(),
                updatedAt: Date.now(),
              });
              city.cityDetails = cityDetailsDoc._id;
            } else {
              cityDetailsDoc.set({
                coordinates: cityProfile.coordinates || cityDetailsDoc.coordinates,
                country: cityProfile.country || cityDetailsDoc.country,
                population: cityProfile.population || cityDetailsDoc.population,
                description: cityProfile.historicalImportance || cityDetailsDoc.description,
                topAttractions: cityProfile.topAttractions || cityDetailsDoc.topAttractions,
                politicalContext: cityProfile.politicalContext || cityDetailsDoc.politicalContext,
                historicalImportance: cityProfile.historicalImportance || cityDetailsDoc.historicalImportance,
                notablePersonalities: cityProfile.notablePersonalities || cityDetailsDoc.notablePersonalities,
                popularFor: cityProfile.popularFor || cityDetailsDoc.popularFor,
                imageUrls: cityProfile.imageUrls || cityDetailsDoc.imageUrls,
                cityMap: cityProfile.cityMap || cityDetailsDoc.cityMap,
                updatedAt: Date.now(),
              });
            }
            await cityDetailsDoc.save({ session });
            await city.save({ session });
          }
        }

        const savedItems = [];
        for (const item of items) {
          if (item.type === 'travelRoutes') {
            if (!item.from || !item.to || !item.transports || !Array.isArray(item.transports)) {
              console.warn(`Skipping invalid travelRoutes item: ${JSON.stringify(item)}`);
              continue;
            }
          } else if (!item.name || !item.description || !item.city) {
            console.warn(`Skipping invalid item: ${JSON.stringify(item)}`);
            continue;
          }

          let Model;
          let newItem;
          switch (item.type) {
            case 'attractions':
              Model = Attraction;
              newItem = new Model({
                name: item.name,
                description: item.description,
                city: item.city,
                cityId: item.cityId,
                images: item.images || [],
                category: item.category || 'attraction',
                rating: item.rating || 0,
              });
              break;
            case 'events':
              Model = Event;
              newItem = new Model({
                name: item.name,
                description: item.description,
                city: item.city,
                cityId: item.cityId,
                images: item.images || [],
                category: item.category || 'event',
                rating: item.rating || 0,
              });
              break;
            case 'adventures':
              Model = Adventure;
              newItem = new Model({
                name: item.name,
                description: item.description,
                city: item.city,
                cityId: item.cityId,
                images: item.images || [],
                category: item.category || 'adventure',
                rating: item.rating || 0,
              });
              break;
            case 'cuisines':
              Model = Cuisine;
              newItem = new Model({
                name: item.name,
                description: item.description,
                city: item.city,
                cityId: item.cityId,
                images: item.images || [],
                category: item.category || 'cuisine',
                rating: item.rating || 0,
              });
              break;
            case 'travelRoutes':
              Model = Route;
              newItem = new Model({
                from: item.from,
                to: item.to,
                transports: item.transports || [],
                city: item.city,
                cityId: item.cityId,
                images: item.images || [],
              });
              break;
            default:
              console.warn(`Invalid item type: ${item.type}`);
              continue;
          }

          await newItem.save({ session });
          savedItems.push(newItem);

          const cacheKey =
            item.type === 'travelRoutes'
              ? `${item.city}:travelRoutes:${item.from.replace(/\s+/g, '_')}_to_${item.to.replace(/\s+/g, '_')}`
              : `${item.city}:${item.type}:${item.name.replace(/\s+/g, '_')}`;
          setCache(cacheKey, { ...item, _id: newItem._id });
        }

        if (savedItems.length === 0) {
          throw new Error('No valid items were saved');
        }

        await session.commitTransaction();
        previewCache.delete(previewId);

        res.status(200).json({ success: true, savedItems });
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } catch (error) {
      console.error('Error in confirmCityItems:', error.message);
      res.status(500).json({ error: error.message || 'Server error' });
    }
  },
];

// Get attraction by ID
export const getAttractionById = [
  async (req, res) => {
    try {
      const { id } = req.params;
      const item = getCache(id);
      if (!item) {
        return res.status(404).json({ error: 'Item not found in cache' });
      }
      res.status(200).json(item);
    } catch (error) {
      console.error('Error in getAttractionById:', error.message);
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  },
];

// Generate custom AI content
export const generateCustomContent = [
  authMiddleware,
  async (req, res) => {
    try {
      const { prompt, cacheKey, parseJson = false, maxTokens = 1000 } = req.body;
      if (!prompt || !cacheKey) {
        return res.status(400).json({ error: 'Prompt and cacheKey are required' });
      }

      const content = await generateAIContent(prompt, cacheKey, {
        maxTokens,
        parseJson,
        fallback: 'Unable to generate content.',
      });

      res.status(200).json({ content });
    } catch (error) {
      console.error('Error in generateCustomContent:', error.message);
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  },
];

// Get all city items
export const getAllCityItems = [
  async (req, res) => {
    try {
      const { cityName } = req.query;
      if (!cityName) {
        return res.status(400).json({ error: 'City name is required' });
      }

      const city = await City.findOne({ cityName }).populate('cityDetails');
      if (!city) return res.status(404).json({ error: 'City not found' });

      // Build cityDetails object
      const cityDetails = city.cityDetails
        ? {
            coordinates: city.cityDetails.coordinates || { latitude: "0", longitude: "0" },
            country: city.cityDetails.country || "India",
            population: city.cityDetails.population || 0,
            description: city.cityDetails.description || "",
            topAttractions: city.cityDetails.topAttractions || [],
            politicalContext: city.cityDetails.politicalContext || { MLA: "", MP: "" },
            historicalImportance: city.cityDetails.historicalImportance || "",
            notablePersonalities: city.cityDetails.notablePersonalities || [],
            popularFor: city.cityDetails.popularFor || { business: "", craft: "", events: "" },
            imageUrls: city.cityDetails.imageUrls || [],
            cityMap: city.cityDetails.cityMap || "",
          }
        : {
            coordinates: { latitude: "0", longitude: "0" },
            country: "India",
            population: 0,
            description: "",
            topAttractions: [],
            politicalContext: { MLA: "", MP: "" },
            historicalImportance: "",
            notablePersonalities: [],
            popularFor: { business: "", craft: "", events: "" },
            imageUrls: [],
            cityMap: "",
          };

      // Fetch all item types
      const attractions = await Attraction.find({ city: cityName }).lean();
      const events = await Event.find({ city: cityName }).lean();
      const adventures = await Adventure.find({ city: cityName }).lean();
      const cuisines = await Cuisine.find({ city: cityName }).lean();
      const travelRoutes = await Route.find({ city: cityName }).lean();

      // Merge all items into a single array
      const items = [
        ...attractions.map((item) => ({
          ...item,
          type: 'attractions',
          cacheKey: `${cityName}:attractions:${item.name.replace(/\s+/g, '_')}`,
        })),
        ...events.map((item) => ({
          ...item,
          type: 'events',
          cacheKey: `${cityName}:events:${item.name.replace(/\s+/g, '_')}`,
        })),
        ...adventures.map((item) => ({
          ...item,
          type: 'adventures',
          cacheKey: `${cityName}:adventures:${item.name.replace(/\s+/g, '_')}`,
        })),
        ...cuisines.map((item) => ({
          ...item,
          type: 'cuisines',
          cacheKey: `${cityName}:cuisines:${item.name.replace(/\s+/g, '_')}`,
        })),
        ...travelRoutes.map((item) => ({
          ...item,
          type: 'travelRoutes',
          cacheKey: `${cityName}:travelRoutes:${item.from.replace(/\s+/g, '_')}_to_${item.to.replace(/\s+/g, '_')}`,
        })),
      ];

      // Cache each item
      items.forEach((item) => {
        setCache(item.cacheKey, item);
      });

      // Return response
      res.status(200).json({ cityDetails, items });
    } catch (error) {
      console.error('Error in getAllCityItems:', error.message);
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  },
];

export { setCache, getCache, authMiddleware };
