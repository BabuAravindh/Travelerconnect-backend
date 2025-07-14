import { OpenAI } from "openai";
import { setCache, getCache } from "../utils/cache.js";
import axios from "axios";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Cache TTL for AI-generated data
const CONTENT_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days for static content

// Generic AI content generation with custom prompt
export const generateAIContent = async (prompt, cacheKey, options = {}) => {
  const {
    model = "gpt-3.5-turbo",
    maxTokens = 1500, 
    temperature = 0.7,
    ttl = CONTENT_CACHE_TTL,
    parseJson = true,
    fallback = null,
  } = options;

  const cachedData = getCache(cacheKey);
  if (cachedData) {
    console.log(`Retrieved cached AI content for key "${cacheKey}"`);
    return {
      success: true,
      content: cachedData.content,
      tokenUsage: cachedData.tokenUsage || { inputTokens: 0, outputTokens: 0 }, // Include token usage if cached
      message: "Content retrieved from cache.",
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "You are a travel expert." },
        { role: "user", content: prompt },
      ],
      max_tokens: maxTokens,
      temperature,
    });

    let content = response.choices[0]?.message.content?.trim() || fallback;
    console.log(`[AI] Raw content for "${cacheKey}":`, content.slice(0, 2000));

  if (parseJson) {
  // Strip common formatting wrappers
  const jsonStart = content.indexOf('{');
  const jsonEnd = content.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
    console.error(`Malformed JSON boundaries in AI content for "${cacheKey}"`);
    return {
      success: false,
      content: fallback,
      tokenUsage: { inputTokens: 0, outputTokens: 0 },
      message: `Invalid JSON structure returned by AI.`,
    };
  }

  const rawJson = content.slice(jsonStart, jsonEnd + 1).trim();

  try {
     content = JSON.parse(rawJson);
  } catch (error) {
   console.error(`❌ Failed JSON parse for "${cacheKey}": ${error.message}`);
  console.log(`[RAW JSON ERROR]:\n${rawJson.slice(0, 1000)}\n...`);
  return {
    success: false,
    content: fallback,
    tokenUsage: { inputTokens: 0, outputTokens: 0 },
    message: `AI JSON output was invalid. View server logs for preview.`,
  };
  }
}


    const tokenUsage = {
      inputTokens: response.usage.prompt_tokens,
      outputTokens: response.usage.completion_tokens,
    };

    const result = { content, tokenUsage };
    setCache(cacheKey, result, ttl);
    console.log(`Generated AI content for key "${cacheKey}"`);
    return {
      success: true,
      content,
      tokenUsage,
      message: "Content generated successfully.",
    };
  } catch (error) {
    console.error(`Error generating AI content for "${cacheKey}": ${error.message}`);
    const partialContent = error.response?.data?.choices?.[0]?.message?.content?.trim() || fallback || "No content generated.";
    console.log(`[AI] Partial content for "${cacheKey}":`, partialContent.slice(0, 2000)); // preview
    return {
      success: false,
      content: partialContent,
      tokenUsage: { inputTokens: 0, outputTokens: 0 },
      message: `Failed to generate content: ${error.message}. Partial content (if any) is provided. Use POST /generateCustomContent with a valid JWT token to submit custom content manually.`,
    };
  }
  console.log(`[AI] Raw content for "${cacheKey}":`, content.slice(0, 2000)); // preview
};

// Fetch city coordinates using Nominatim API (unchanged, included for completeness)
export const fetchCityCoordinates = async (cityName) => {
  const cacheKey = `city:${cityName}:coords`;
  const cachedData = getCache(cacheKey);
  if (cachedData) {
    console.log(`Retrieved cached coordinates for "${cityName}"`);
    return { success: true, coords: cachedData, message: "Coordinates retrieved from cache." };
  }

  try {
    const response = await axios.get("https://nominatim.openstreetmap.org/search", {
      params: { q: cityName, format: "json", limit: 1, addressdetails: 1 },
      headers: { "User-Agent": "TravelApp/1.0 (contact@example.com)" },
      timeout: 5000,
    });

    if (!response.data || response.data.length === 0) {
      console.warn(`No coordinates found for "${cityName}"`);
      return {
        success: false,
        coords: { latitude: null, longitude: null, country: null },
        message: `No coordinates found for "${cityName}". Submit coordinates manually using POST /generateCustomContent with a valid JWT token.`,
      };
    }

    const { lat, lon, address } = response.data[0];
    const coords = {
      latitude: parseFloat(lat),
      longitude: parseFloat(lon),
      country: address.country || null,
    };
    setCache(cacheKey, coords, CONTENT_CACHE_TTL);
    console.log(`Fetched coordinates for "${cityName}": ${JSON.stringify(coords)}`);
    return { success: true, coords, message: "Coordinates fetched successfully." };
  } catch (error) {
    console.error(`Error fetching coordinates for "${cityName}": ${error.message}`);
    return {
      success: false,
      coords: { latitude: null, longitude: null, country: null },
      message: `Failed to fetch coordinates for "${cityName}": ${error.message}. Submit coordinates manually using POST /generateCustomContent with a valid JWT token.`,
    };
  }
};
