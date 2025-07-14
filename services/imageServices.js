
import axios from "axios";
import { setCache, getCache } from "../utils/cache.js";
import * as fuzzball from "fuzzball";

const IMAGE_CACHE_TTL = 24 * 60 * 60 * 1000; // 1 day
const usedImages = new Set();

const imageApis = [
  {
    name: "Unsplash",
    url: "https://api.unsplash.com/search/photos",
    headers: { Authorization: `Client-ID ${process.env.UNSPLASH_API_KEY}` },
    getImageUrl: (result) => result.urls?.regular,
    getMetadata: (result) => ({
      tags: result.tags?.map((tag) => tag.title) || [],
      description: result.description || result.alt_description || "",
    }),
    params: (query) => ({ query, per_page: 30 }),
  },
  {
    name: "Pexels",
    url: "https://api.pexels.com/v1/search",
    headers: { Authorization: process.env.PEXELS_API_KEY },
    getImageUrl: (result) => result.src?.original,
    getMetadata: (result) => ({
      tags: result.alt?.split(", ") || [],
      description: result.alt || "",
    }),
    params: (query) => ({ query, per_page: 30 }),
  },
];

export const getImageFromApis = async (queries) => {
  const queryList = Array.isArray(queries) ? queries : [queries];
  const results = [];

  // Step 1: Check cache for all queries
  for (const query of queryList) {
    const { name, city, type } = query;
    const cacheKey = `image:${name}:${city}:${type}`;
    const cachedImage = getCache(cacheKey);
    if (cachedImage) {
      console.log(`Retrieved cached image for "${name}" in ${city} (${type})`);
      results.push({
        success: true,
        imageUrl: cachedImage,
        imageFound: true,
        message: "Image retrieved from cache.",
        query,
      });
    } else {
      results.push({ cacheMiss: true, query });
    }
  }

  const queriesToFetch = results.filter((r) => r.cacheMiss).map((r) => r.query);
  if (queriesToFetch.length === 0) {
    return results.map((r) => ({
      success: r.success,
      imageUrl: r.imageUrl,
      imageFound: r.imageFound,
      message: r.message,
    }));
  }

  // Step 2: Process each query individually, looping through APIs
  const selectedImages = [];
  for (const query of queriesToFetch) {
    const { name, city, type } = query;
    const cacheKey = `image:${name}:${city}:${type}`;
    let selectedImage = null;

    // Try each API until a suitable image is found
    for (const api of imageApis) {
      try {
        const searchQuery = `${name} ${city} ${type}`.trim().replace(/[^a-zA-Z0-9\s]/g, "");
        console.log(`Fetching image from ${api.name} for "${searchQuery}"`);

        const response = await axios.get(api.url, {
          headers: api.headers,
          params: api.params(searchQuery),
          timeout: 10000,
        });

        const apiResults = response.data.results || response.data.photos || [];
        if (!apiResults || apiResults.length === 0) {
          console.log(`No results from ${api.name} for "${searchQuery}"`);
          continue;
        }

        // Find a relevant image
        for (const result of apiResults) {
          const imageUrl = api.getImageUrl(result);
          if (!imageUrl || !imageUrl.startsWith("https://") || usedImages.has(imageUrl)) {
            continue;
          }

          const metadata = api.getMetadata(result);
          const relevantKeywords = name.toLowerCase().split(" ").concat([city.toLowerCase(), type.toLowerCase()]);
          const isRelevant = relevantKeywords.some(
            (keyword) =>
              metadata.tags.some((tag) => fuzzball.partial_ratio(keyword, tag.toLowerCase()) > 40) ||
              fuzzball.partial_ratio(keyword, metadata.description.toLowerCase()) > 40 ||
              fuzzball.partial_ratio(keyword, imageUrl.toLowerCase()) > 40
          );

          if (isRelevant) {
            try {
              const urlCheck = await axios.head(imageUrl, { timeout: 10000 });
              if (urlCheck.status === 200 && urlCheck.headers["content-type"]?.startsWith("image/")) {
                selectedImage = { imageUrl, result };
                usedImages.add(imageUrl);
                setCache(cacheKey, imageUrl, IMAGE_CACHE_TTL);
                console.log(`Selected image from ${api.name} for "${name}" in ${city} (${type})`);
                break;
              }
            } catch (error) {
              console.log(`Invalid image URL from ${api.name} for "${searchQuery}": ${error.message}`);
              continue;
            }
          }
        }

        if (selectedImage) {
          selectedImages.push({ query, imageUrl: selectedImage.imageUrl, imageFound: true });
          break;
        }
      } catch (error) {
        console.log(`Error fetching from ${api.name} for "${searchQuery}": ${error.message}`);
        continue;
      }
    }

    // If no image was found, use a placeholder
    if (!selectedImage) {
      const placeholderImage = "https://via.placeholder.com/1080x720.png?text=No+Image+Available";
      setCache(cacheKey, placeholderImage, IMAGE_CACHE_TTL);
      selectedImages.push({
        query,
        imageUrl: placeholderImage,
        imageFound: false,
      });
      console.log(`No image found for "${name}" in ${city} (${type}); using placeholder`);
    }
  }

  // Step 3: Cache the batch result
  const cacheKeyCombined = `image:batch:${queriesToFetch
    .map(({ name, city, type }) => `${name}:${city}:${type}`)
    .join(",")}`;
  setCache(cacheKeyCombined, selectedImages, IMAGE_CACHE_TTL);

  // Step 4: Map results back to original queries
  return queryList.map((query) => {
    const result = results.find((r) => !r.cacheMiss && r.query === query);
    if (result) {
      return {
        success: true,
        imageUrl: result.imageUrl,
        imageFound: result.imageFound,
        message: result.message,
      };
    }

    const selected = selectedImages.find((img) => img.query === query);
    return {
      success: true,
      imageUrl: selected?.imageUrl || "https://via.placeholder.com/1080x720.png?text=No+Image+Available",
      imageFound: selected?.imageFound || false,
      message: selected?.imageFound ? "Image fetched successfully." : "No image found; using placeholder.",
    };
  });
};
