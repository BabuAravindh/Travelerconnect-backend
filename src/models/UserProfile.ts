
import mongoose from "mongoose";
import { Country, State, Language, GuideLanguage } from "../models/predefineSchemas.js";

const userProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  dateOfBirth: { type: Date },
  profilePicture: { type: String,  },
  address: {
    street: String,
    cityId: { type: mongoose.Schema.Types.ObjectId, ref: "City" },
    stateId: { type: mongoose.Schema.Types.ObjectId, ref: "State" },
    countryId: { type: mongoose.Schema.Types.ObjectId, ref: "Country" },
    postalCode: { type: String },
  },
  dateJoined: { type: Date, default: Date.now },
  lastLogin: { type: Date },
  gender: {
    type: String,
    enum: ["male", "female", "others"],
    required: true
  },
});

const UserProfile = mongoose.model("UserProfile", userProfileSchema);
export default UserProfile;
