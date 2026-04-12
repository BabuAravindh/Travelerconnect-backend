import mongoose from "mongoose";

const requestSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    guideId: { type: mongoose.Schema.Types.ObjectId, ref: "Guide", required: true },
    paymentStatus: { type: String, default: "pending" },
    status: { type: String, default: "pending" },
    createdAt: { type: Date, default: Date.now, expires: 86400 }, 
  },
  { timestamps: true }
);

const Request = mongoose.model("Request", requestSchema);
export default Request;

