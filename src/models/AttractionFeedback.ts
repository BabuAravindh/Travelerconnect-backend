import mongoose from "mongoose";

const attractionFeedbackSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  attractionId: { type: mongoose.Schema.Types.ObjectId, ref: "Attraction", required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comments: { type: String },
  submittedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ["submitted", "not submitted"], required: true },
});

const AttractionFeedback = mongoose.model("AttractionFeedback", attractionFeedbackSchema);
export default AttractionFeedback;
