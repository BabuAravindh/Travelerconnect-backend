import mongoose from "mongoose";

const AttractionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Attraction name is required"],
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
      default: "attraction",
    },
    rating: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export const Attraction = mongoose.model("Attraction", AttractionSchema);
export default Attraction;