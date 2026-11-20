import { RateLimiterMemory } from "rate-limiter-flexible";

const limiters = new Map();

function getLimiter(key, points, duration) {
  const limiterKey = `${key}:${points}:${duration}`;
  if (!limiters.has(limiterKey)) {
    limiters.set(limiterKey, new RateLimiterMemory({ points, duration }));
  }
  return limiters.get(limiterKey);
}

export const authRateLimit = (key, points, duration) => {
  const limiter = getLimiter(key, points, duration);
  return async (req, res, next) => {
    try {
      await limiter.consume(req.ip);
      next();
    } catch {
      res.status(429).json({ message: "Too many requests. Please try again later." });
    }
  };
};
