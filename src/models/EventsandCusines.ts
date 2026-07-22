
import mongoose from "mongoose";

const EventSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Event name is required"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
    },
    city: {
      type: String,
      required: [true, "City is required"],
    },
    cityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "City",
      required: [true, "City ID is required"],
    },
    images: {
      type: [String],
      default: [],
    },
    category: {
      type: String,
      default: "event",
    },
    rating: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const AdventureSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Adventure name is required"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
    },
    city: {
      type: String,
      required: [true, "City is required"],
    },
    cityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "City",
      required: [true, "City ID is required"],
    },
    images: {
      type: [String],
      default: [],
    },
    category: {
      type: String,
      default: "adventure",
    },
    rating: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const CuisineSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Cuisine name is required"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
    },
    city: {
      type: String,
      required: [true, "City is required"],
    },
    cityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "City",
      required: [true, "City ID is required"],
    },
    images: {
      type: [String],
      default: [],
    },
    category: {
      type: String,
      default: "cuisine",
    },
    rating: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export const Event = mongoose.model("Event", EventSchema);
export const Adventure = mongoose.model("Adventure", AdventureSchema);
export const Cuisine = mongoose.model("Cuisine", CuisineSchema);
