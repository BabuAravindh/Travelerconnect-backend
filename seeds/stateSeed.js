import mongoose from "mongoose";
import dotenv from "dotenv";
import State from "../models/State.js";

dotenv.config();

// Your MongoDB URI
const MONGODB_URI = process.env.MONGO_URI || "mongodb://localhost:27017/travelerconnect";

// Predefined State Data
const states = [
  { stateName: "California", order: 1 },
  { stateName: "New York", order: 2 },
  { stateName: "Texas", order: 3 },
  { stateName: "Florida", order: 4 },
  { stateName: "Nevada", order: 5 },
  { stateName: "Colorado", order: 6 },
];

const seedStates = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Clear existing states
    await State.deleteMany();
    console.log("✅ Existing states cleared.");

    // Insert predefined states
    await State.insertMany(states);
    console.log("✅ Predefined states added successfully.");

    mongoose.connection.close();
  } catch (error) {
    console.error("❌ Error seeding states:", error);
    process.exit(1);
  }
};

// Run the seeding function
seedStates();
