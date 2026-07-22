// models/activityModel.js
import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema({
  activityName: { type: String, required: true },
  order: { type: Number, required: true }
}, { timestamps: true });

export default mongoose.model('Activity', activitySchema);
