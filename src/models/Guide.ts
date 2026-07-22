import mongoose from "mongoose";
import validator from "validator";

const guideSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: [true, "User reference is required"],
    unique: true
  },
  languages: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Language", 
    required: [true, "At least one language is required"],
  }],
  bio: { 
    type: String, 
    required: [true, "Bio is required"],
    minlength: [50, "Bio must be at least 50 characters"],
    maxlength: [500, "Bio cannot exceed 500 characters"]
  },
  serviceLocations: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'City',
  }],
  profilePic: {
    type: mongoose.Schema.Types.Mixed,
  },
  activities: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Activity",
    required: [true, "At least one activity is required"],
  }],
  bankAccountNumber: { 
    type: String, 
    required: [true, "Bank account number is required"],
    validate: {
      validator: (v) => /^[0-9]{9,18}$/.test(v),
      message: "Invalid bank account number format"
    }
  },
  ifscCode: {
    type: String,
    required: [true, "IFSC code is required"],
    validate: {
      validator: (v) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v),
      message: "Invalid IFSC code format (e.g., SBIN0001234)"
    }
  },
  bankName: {
    type: String,
    required: [true, "Bank name is required"],
    minlength: [2, "Bank name must be at least 2 characters"],
    maxlength: [100, "Bank name cannot exceed 100 characters"]
  },
  active: {
    type: Boolean,
   
  },
  rejectionReason: {
    type: String,
    default: ""
  },
  lastVerifiedAt: Date,
  aadharCardPhoto: { // Added to store government ID metadata
    type: {
      public_id: { type: String, required: true },
      url: { type: String, required: true },
      secure_url: { type: String, required: true },
      uploadedAt: { type: Date, required: true }
    },
    required: [false, "Government ID photo is optional until upload"] // Set to false to allow partial profiles
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  govIdVerified: {
  type: Boolean,
  default: false,
}

});

guideSchema.index({ verificationStatus: 1 });
guideSchema.index({ serviceLocations: 1 });
guideSchema.index({ activities: 1 });

// Virtual for formatted bank account (last 4 digits)
guideSchema.virtual('maskedBankAccount').get(function() {
  return this.bankAccountNumber 
    ? `•••• ${this.bankAccountNumber.slice(-4)}` 
    : '';
});

const Guide = mongoose.model("Guide", guideSchema);
export default Guide;