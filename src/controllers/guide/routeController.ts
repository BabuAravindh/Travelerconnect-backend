
import { authMiddleware } from "./AttractionController.js";
import Route from "../../models/routeSchema.js";
import { City } from "../../models/predefineSchemas.js";
import { setCache } from "../../utils/cache.js";
import mongoose from "mongoose";
import { generateAIContent } from "../../utils/aiService.js";

export const generateRoutes = [
  authMiddleware,
  async (req, res) => {
    try {
      const { cityName } = req.params;
      if (!cityName) {
        return res.status(400).json({ error: "City name is required" });
      }

      const city = await City.findOne({ cityName });
      if (!city) return res.status(404).json({ error: "City not found" });

      // Placeholder: Assuming deductCredits is defined elsewhere
      // await deductCredits(req.user.id, `Generate routes for ${cityName}`, {}, 2);

      const prompt = `Generate 3 travel routes to or within ${cityName}. Each route must include: starting point, destination, transports (mode: Bus/Train/Flight/Ferry/Private Vehicle, duration, 25-word details). Return JSON array: [{"from":"City","to":"${cityName}","transports":[{"mode":"Train","duration":"2h","details":"..."}]}].`;
      const cacheKey = `items:${cityName}:travelRoutes`;

      const routesResult = await generateAIContent(prompt, cacheKey, {
        maxTokens: 250, // Unchanged, sufficient for 3 routes with 25-word details
        ttl: 24 * 60 * 60 * 1000,
        parseJson: true,
        fallback: [],
      });

      const routes = routesResult.content;

      const formattedRoutes = routes.slice(0, 3).map((route) => ({
        from: route.from?.trim() || "Unknown",
        to: route.to?.trim() || cityName,
        transports: Array.isArray(route.transports)
          ? route.transports.map((t) => ({
              mode: t.mode || "Bus",
              duration: t.duration || "Unknown",
              details: t.details || "No details provided.",
            }))
          : [],
        guideId: req.user.id,
        city: cityName,
        cityId: city._id,
        type: "travelRoutes",
        createdAt: new Date().toISOString(),
      }));

      if (formattedRoutes.length < 3) {
        console.warn(`Generated only ${formattedRoutes.length}/3 routes for ${cityName}`);
      }

      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        const savedRoutes = [];
        for (const route of formattedRoutes) {
          const newRoute = new Route({
            from: route.from,
            to: route.to,
            transports: route.transports,
            guideId: route.guideId,
            city: route.city,
            cityId: route.cityId,
          });
          await newRoute.save({ session });
          savedRoutes.push(newRoute);

          const cacheKey = `${cityName}:travelRoutes:${route.from.replace(/\s+/g, "_")}_to_${route.to.replace(/\s+/g, "_")}`;
          setCache(cacheKey, { ...route, _id: newRoute._id });
        }

        await session.commitTransaction();
        res.status(200).json(savedRoutes);
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } catch (error) {
      console.error("Error in generateRoutes:", error.message);
      res.status(500).json({ error: error.message || "Server error" });
    }
  },
];

export const getAllRoutes = [
  async (req, res) => {
    try {
      const { cityName } = req.query;
      if (!cityName) {
        return res.status(400).json({ error: "City name is required" });
      }

      const city = await City.findOne({ cityName });
      if (!city) return res.status(404).json({ error: "City not found" });

      const routes = await Route.find({ to: cityName }).lean();

      const formattedRoutes = routes.map((route) => ({
        ...route,
        type: "travelRoutes",
        city: cityName,
        cityId: city._id,
        cacheKey: `${cityName}:travelRoutes:${route.from.replace(/\s+/g, "_")}_to_${route.to.replace(/\s+/g, "_")}`,
      }));

      formattedRoutes.forEach((route) => {
        setCache(route.cacheKey, route);
      });

      res.status(200).json(formattedRoutes);
    } catch (error) {
      console.error("Error in getAllRoutes:", error.message);
      res.status(500).json({ error: "Internal server error", details: error.message });
    }
  },
];