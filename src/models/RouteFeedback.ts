import mongoose from "mongoose";

const routeFeedbackSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  routeId: { type: mongoose.Schema.Types.ObjectId, ref: "Route", required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comments: { type: String },
  submittedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ["submitted", "not submitted"], required: true },
});

const RouteFeedback = mongoose.model("RouteFeedback", routeFeedbackSchema);
export default RouteFeedback;
