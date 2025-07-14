import mongoose from "mongoose";
import dotenv from "dotenv";
import { City } from "../models/predefineSchemas.js";

dotenv.config();

const cities = [
  "Mumbai",
  "Pune",
  "Chennai",
  "Panchetti",
  "Coimbatore",
  "Kolkata",
  "Jaipur",
  "Lucknow",
 "Madurai",
];

const seedCities = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ Connected to MongoDB");

    // Clear existing cities
    await City.deleteMany({});
    console.log("🗑️ Existing cities deleted");

    // Prepare city data
    const cityData = cities.map((cityName, index) => ({
      cityName,
      order: index + 1,
    }));

    // Insert cities
    await City.insertMany(cityData);
    console.log("🌍 Cities seeded successfully");

    mongoose.connection.close();
  } catch (error) {
    console.error("❌ Error seeding cities:", error);
    mongoose.connection.close();
  }
};

seedCities();
