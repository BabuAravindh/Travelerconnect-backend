import mongoose from "mongoose";
const GuideRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  languages: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "Language",
    required: true,
    validate: {
      validator: function (v) {
        return v.length >= 2;
      },
      message: "You must select at least two languages",
    },
  },
  activities: {
    type: [String],
    required: true,
    validate: {
      validator: function (v) {
        return v.length > 0;
      },
      message: "At least one activity is required",
    },
  },
  states: [ // Keep as states to match schema
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "State",
    },
  ],
  cities: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "City",
      required: true,
    }
  ],
  aadharCardPhoto: {
    type: String,
    required: true,
  },
  bankAccountNumber: {
    type: String,
    required: true,
    validate: {
      validator: function (v) {
        return /^\d{9,18}$/.test(v);
      },
      message: "Invalid bank account number",
    },
  },
  bio: {
    type: String,
    required: true,
    minlength: 50,
    maxlength: 1000,
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
  reviewedAt: {
    type: Date,
  },
  reviewNotes: {
    type: String,
  },
}, { timestamps: true });

const GuideRequest = mongoose.model("GuideRequest", GuideRequestSchema);

export default GuideRequest;