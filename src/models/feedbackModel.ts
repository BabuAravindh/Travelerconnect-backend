import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  guideId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comments: { type: String },
  submittedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ["submitted", "not submitted"], required: true },
});

const Feedback = mongoose.model("Feedback", feedbackSchema);
export default Feedback;
