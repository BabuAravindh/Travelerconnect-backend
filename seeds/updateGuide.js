// seeds/updateGuide.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import Guide from "../models/Guide.js";

dotenv.config(); // Make sure .env is in the root directory

console.log("MONGO_URI:", process.env.MONGO_URI); // Debug

const updateOldGuides = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const result = await Guide.updateMany(
      { status: { $exists: false } },
      { $set: { status: "pending" } }
    );

    console.log("✅ Old guide records updated:", result.modifiedCount);
  } catch (err) {
    console.error("❌ Error updating old guides:", err);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
};

updateOldGuides();
