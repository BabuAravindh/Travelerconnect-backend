import mongoose from 'mongoose';

const travelPlanSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  planId: { type: String, required: true, unique: true },
  cityName: { type: String, required: true },
  questions: [
    {
      _id: String,
      questionText: String,
      cityId: {
        _id: String,
        cityName: String,
        order: Number,
        createdAt: String,
      },
      status: String,
      order: Number,
      createdAt: String,
      updatedAt: String,
      type: String,
      options: [String],
    },
  ],
  answers: [{ response: String }],
  itinerary: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('TravelPlan', travelPlanSchema);