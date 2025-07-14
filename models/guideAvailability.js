import mongoose from "mongoose";

const guideAvailabilitySchema = new mongoose.Schema({
  guideId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  availableDay: { type: Number, required: true }, // Example: 0 = Sunday, 1 = Monday
  isBooked: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model('GuideAvailability', guideAvailabilitySchema);
