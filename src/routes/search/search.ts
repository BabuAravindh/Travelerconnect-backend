import express from "express";
import { fetch } from 'undici'
import Guide from "../../models/Guide.js";
import { State,Language,City } from "../../models/predefineSchemas.js";
import activityModel from "../../models/activityModel.js";
import UserProfile from "../../models/UserProfile.js";
const router = express.Router();

// Search guides by name
router.get("/", async (req, res) => {
  try {
    const { name } = req.query;

    if (!name) {
      return res.status(400).json({ error: "Name query parameter is required" });
    }

    // Fetch all guides
    const response = await fetch("http://localhost:5000/api/guide/profile");
    const guides = await response.json();

    if (!Array.isArray(guides)) {
      return res.status(500).json({ error: "Invalid API response format" });
    }

    // Filter guides by name (case-insensitive)
    const filteredGuides = guides.filter((guide) =>
      guide.name.toLowerCase().includes(name.toLowerCase())
    );

    res.json(filteredGuides);
  } catch (error) {
    console.error("Error fetching guides:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
router.get("/guides", async (req, res) => {
  try {
    const { language, gender, activity, city } = req.query;
    let filters = {};

    // Filter by gender (From UserProfile)
    if (gender) {
      const usersByGender = await UserProfile.find({ gender }).select("userId");
      const userIdsByGender = usersByGender.map((user) => user.userId);
      filters.userId = { $in: userIdsByGender };
    }

    // Filter by language
    if (language) {
      let lang = await Language.findOne({ languageName: { $regex: `^${language}$`, $options: "i" } }).select("_id");
      if (lang) {
        filters.languages = lang._id;
      }
    }

    // Filter by activity
    if (activity) {
      let activityObj = await Activity.findOne({ activityName: activity.trim() }).select("_id");
      if (activityObj) {
        filters.activities = activityObj._id;
      }
    }

    // Filter by city
    if (city) {
      let cityObj = await City.findOne({ cityName: { $regex: `^${city}$`, $options: "i" } }).select("_id");
      if (cityObj) {
        filters.serviceLocations = cityObj._id;
      }
    }

    const guides = await Guide.find(filters)
      .populate("languages", "languageName")
      .populate("activities", "activityName")
      .populate("serviceLocations", "cityName");

    const mappedGuides = guides.map(guide => ({
      ...guide.toObject(),
      languages: guide.languages?.map(lang => lang.languageName) || [],
      activities: guide.activities?.map(act => act.activityName) || [],
      serviceLocations: guide.serviceLocations?.map(city => city.cityName) || [],
    }));

    res.json({ success: true, data: mappedGuides });
  } catch (error) {
    console.error("Error fetching guides:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});


router.get("/guides/city", async (req, res) => {
  try {
    const { city } = req.query;

    if (!city) {
      return res.status(400).json({
        success: false,
        message: "City name is required to filter guides.",
      });
    }

    // Find the city ID by name
    const cityObj = await City.findOne({
      cityName: { $regex: `^${city}$`, $options: "i" },
    }).select("_id");

    if (!cityObj) {
      return res.status(404).json({
        success: false,
        message: `City '${city}' not found.`,
      });
    }

    // Find guides who serve this city
    const guides = await Guide.find({ serviceLocations: cityObj._id })
      .populate("userId", "name") // Get name from User schema
      .populate("languages", "languageName")
      .populate("activities", "activityName")
      .populate("serviceLocations", "cityName");

    // Format the output
    const mappedGuides = guides.map((guide) => ({
      ...guide.toObject(),
      name: guide.userId?.name || "",
      languages: guide.languages?.map((lang) => lang.languageName) || [],
      activities: guide.activities?.map((act) => act.activityName) || [],
      serviceLocations:
        guide.serviceLocations?.map((city) => city.cityName) || [],
    }));

    res.json({ success: true, data: mappedGuides });
  } catch (error) {
    console.error("Error fetching guides by city:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch guides by city." });
  }
});



export default router;
