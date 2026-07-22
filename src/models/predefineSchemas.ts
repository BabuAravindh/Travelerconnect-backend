
import mongoose from "mongoose";

const languageSchema = new mongoose.Schema({
  languageName: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  languageStatus: {
    type: String,
    enum: ["active", "inactive"],
    required: true,
  },
  order: { type: Number },
});

const countrySchema = new mongoose.Schema({
  countryName: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  order: { type: Number },
});

const stateSchema = new mongoose.Schema({
  stateName: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  order: { type: Number },
});

const citySchema = new mongoose.Schema({
  cityName: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  order: { type: Number },
  cityDetails: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CityDetails",
  },
});

const cityDetailsSchema = new mongoose.Schema({
  cityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "City",
    required: [true, "City ID is required"],
  },
  coordinates: {
    latitude: { type: String, required: true },
    longitude: { type: String, required: true },
  },
  country: { type: String, default: "India" },
  population: { type: Number, default: 0 },
  description: { type: String, default: "" },
  topAttractions: [{
    name: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
  }],
  politicalContext: {
    MLA: { type: String, default: "" },
    MP: { type: String, default: "" },
  },
  historicalImportance: { type: String, default: "" },
  notablePersonalities: [{ type: String }],
  popularFor: {
    business: { type: String, default: "" },
    craft: { type: String, default: "" },
    events:[ { type: String, default: "" }],
  },
  imageUrls: [{ type: String }],
  cityMap: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const guideLanguageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
  spokenLanguage: { type: String, required: true },
});

const questionSchema = new mongoose.Schema({
  questionText: {
    type: String,
    required: [true, "Question text is required"],
    trim: true,
  },
  cityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "City",
    required: [false, "City ID is required"],
  },
  type: {
    type: String,
    enum: ["specific", "common"],
    required: [true, "Question type is required"],
    default: "specific",
  },
  options: {
    type: [{ type: String, trim: true }],
    required: [
      function () {
        return this.type === "common";
      },
      "Options are required for common questions",
    ],
    validate: {
      validator: function (value) {
        return this.type === "common" ? Array.isArray(value) && value.length > 0 : true;
      },
      message: "Options must be a non-empty array for common questions",
    },
  },
  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "active",
  },
  order: {
    type: Number,
    default: 0,
    min: [1, "Order must be between 1 and 10"],
    max: [10, "Order must be between 1 and 10"],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Middleware to enforce exactly 10 questions per city for specific questions
questionSchema.pre("save", async function (next) {
  if (this.isNew && this.type === "specific") {
    try {
      const questionCount = await mongoose.model("Question").countDocuments({ cityId: this.cityId, type: "specific" });
      if (questionCount >= 10) {
        const error = new Error("Cannot add more than 10 specific questions for this city");
        error.status = 400;
        return next(error);
      }
    } catch (error) {
      return next(error);
    }
  }
  this.updatedAt = Date.now();
  next();
});

// Index to ensure unique order per city for specific questions
questionSchema.index({ cityId: 1, order: 1, type: 1 }, { unique: true, partialFilterExpression: { type: "specific" } });

const Language = mongoose.model("Language", languageSchema);
const Country = mongoose.model("Country", countrySchema);
const State = mongoose.model("State", stateSchema);
const City = mongoose.model("City", citySchema);
const CityDetails = mongoose.model("CityDetails", cityDetailsSchema);
const GuideLanguage = mongoose.model("GuideLanguage", guideLanguageSchema);
const Question = mongoose.model("Question", questionSchema);

export { Language, Country, State, City, CityDetails, GuideLanguage, Question };
