import mongoose from 'mongoose';

const transportDetailSchema = new mongoose.Schema({
  mode: {
    type: String,
    required: true
  },
  duration: {
    type: String,
    required: true
  },
  details: String
});

const routeSchema = new mongoose.Schema({
  from: {
    type: String,
    required: true
  },
  to: {
    type: String,
    required: true
  },
  transports: [transportDetailSchema],
}, { timestamps: true });

const Route = mongoose.model('Route', routeSchema);

export default Route;