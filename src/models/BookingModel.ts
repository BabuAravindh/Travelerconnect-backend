import mongoose from "mongoose";
import {Payment} from "./payment.js"; // Adjust the import path based on your project structure
import createNotification from "../controllers/notificationController.js"; // Adjust the import path

const bookingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    guideId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    bookingDate: { type: Date, default: Date.now },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    budget: { type: Number, required: true },
    pickupLocation: { type: String, required: true },
    dropoffLocation: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "confirmed", "finalized", "paid", "completed", "cancelled", "refunded"],
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "partial", "paid", "refunded"],
      default: "unpaid",
    },
    activities: {
      type: [String],
      default: [],
    },
    totalPaid: { type: Number, default: 0 },
    remainingBalance: { type: Number },
    razorpayOrderId: { type: String },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Post-save hook for booking notifications
bookingSchema.post("save", async function (doc) {
  const userId = doc.userId.toString();
  const guideId = doc.guideId.toString();
  const previousDoc = await this.constructor.findOne({ _id: doc._id }); // Fetch previous state

  // New booking notification for the guide
  if (!previousDoc) {
    const message = `New booking request from ${userId} for ${doc.startDate} to ${doc.endDate} with budget ₹${doc.budget}`;
    await createNotification({
      recipientId: guideId,
      senderId: userId,
      type: "booking_update",
      message,
      senderRole: "user",
    });
  }

  // Status change notification
  if (previousDoc && previousDoc.status !== doc.status) {
    const payment = await Payment.findOne({ bookingId: doc._id });
    const paymentStatusText = payment ? `with payment status ${payment.paymentStatus}` : "";
    const message = `Booking status updated to ${doc.status} ${paymentStatusText} by ${guideId}`;
    const recipientId = ["confirmed", "paid", "completed"].includes(doc.status) ? userId : guideId;
    const senderId = ["confirmed", "paid", "completed"].includes(doc.status) ? guideId : userId;
    await createNotification({
      recipientId,
      senderId,
      type: "booking_update",
      message,
      senderRole: senderId === guideId ? "guide" : "user",
    });
  }

  // Payment status change notification (if managed in Booking)
  if (previousDoc && previousDoc.paymentStatus !== doc.paymentStatus) {
    const message = `Payment status updated to ${doc.paymentStatus} for booking ${doc._id}`;
    const recipientId = ["paid", "refunded"].includes(doc.paymentStatus) ? guideId : userId;
    const senderId = ["paid", "refunded"].includes(doc.paymentStatus) ? userId : guideId;
    await createNotification({
      recipientId,
      senderId,
      type: "payment_update",
      message,
      senderRole: senderId === guideId ? "guide" : "user",
    });
  }
});

const Booking = mongoose.models.Booking || mongoose.model("Booking", bookingSchema);
export default Booking;