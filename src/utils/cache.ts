// utils/cache.js
const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

const setCache = (key, value, ttl = CACHE_TTL) => {
  cache.set(key, { data: value, timestamp: Date.now(), ttl });
};

const getCache = (key) => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > entry.ttl) {
    cache.delete(key);
    return null;
  }
  return entry.data;
};

const clearCache = () => {
  cache.clear();
  console.log('Cache store cleared');
};

export { setCache, getCache, clearCache };