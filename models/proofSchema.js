// models/Proof.js
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const ProofSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: () => uuidv4(),
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    required: true,
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
  },
  files: [{
    publicId: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    format: {
      type: String,
      required: true,
    },
    bytes: {
      type: Number,
      required: true,
    },
    width: Number,
    height: Number,
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.models.Proof || mongoose.model('Proof', ProofSchema);