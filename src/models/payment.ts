import mongoose from "mongoose";
import AutoIncrementFactory from "mongoose-sequence";
import Notification from "../models/Notification.js";
import createNotification from "../controllers/notificationController.js";
import User from "../models/User.js"; // Adjust the import path
import Booking from "./BookingModel.js";
const connection = mongoose.connection;
const AutoIncrement = AutoIncrementFactory(connection);

const ModeOfPaymentSchema = new mongoose.Schema(
  {
    modeOfPayment: {
      type: String,
      required: true,
      enum: ["gpay", "razorpay", "cash", "bank_transfer", "phonepe", "upi", "other"],
      default: "razorpay",
    },
    
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
    details: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: { createdAt: "createdAt" } }
);

const PaymentSchema = new mongoose.Schema(
  {
    modeOfPaymentId: { type: mongoose.Schema.Types.ObjectId, ref: "ModeOfPayment", required: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
    amount: {
      type: Number,
      required: true,
      validate: {
        validator: function (value) {
          return value > 0;
        },
        message: "Payment amount must be positive",
      },
    },
    paymentStatus: {
      type: String,
      enum: ["completed", "pending", "failed", "refunded", "processed"],
      default: "pending",
    },
    paymentType: {
      type: String,
      enum: ["deposit", "installment", "final", "full"],
      default: "full",
    },
    installmentNumber: { type: Number, default: 0 },
    transactionDetails: { type: Object },
    isPartial: { type: Boolean, default: false },
    customerRequest: { type: String },
    customerResponse: { type: mongoose.Schema.Types.Mixed, default: {} },
    payId: { type: String, required: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    completedAt: { type: Date },
    failedAt: { type: Date },
    refundedAt: { type: Date },
    notes: { type: String },
  },
  { timestamps: { updatedAt: "updatedAt" } }
);

// Post-save hook for payment notifications
PaymentSchema.post("save", async function (doc) {
  const userId = doc.recordedBy?.toString() || (await Booking.findById(doc.bookingId)).userId.toString();
  const guideId = (await Booking.findById(doc.bookingId)).guideId.toString();
  const previousDoc = await this.constructor.findOne({ _id: doc._id });

  // Populate sender and recipient details
  const sender = await User.findById(userId).select("name avatar _id").lean();
  const recipient = await User.findById(guideId).select("name avatar _id").lean();

  // New payment notification for the guide
  if (!previousDoc) {
    const message = `New payment of ₹${doc.amount} (${doc.paymentType}) received from ${sender.name} for a booking`;
    await createNotification({
      recipientId: guideId,
      senderId: userId,
      type: "payment_update",
      message,
      senderRole: "user",
    });
  }

  // Payment status change notification
  if (previousDoc && previousDoc.paymentStatus !== doc.paymentStatus) {
    const message = `Payment status updated to ${doc.paymentStatus} for ₹${doc.amount} (${doc.paymentType}) by ${sender.name}`;
    const recipientId = ["completed", "refunded"].includes(doc.paymentStatus) ? guideId : userId;
    const senderId = ["completed", "refunded"].includes(doc.paymentStatus) ? userId : guideId;
    await createNotification({
      recipientId,
      senderId,
      type: "payment_update",
      message,
      senderRole: senderId === guideId ? "guide" : "user",
    });
  }
});

const RefundSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["refunded", "pending"],
      default: "pending",
    },
    proof: { type: String, default: null },
    adminComment: { type: String, default: null },
    refundedAt: { type: Date },
  },
  { timestamps: { createdAt: "createdAt" } }
);

if (!mongoose.models.ModeOfPayment) {
  ModeOfPaymentSchema.plugin(AutoIncrement, {
    id: "mode_of_payment_order",
    inc_field: "order",
    start_seq: 1000,
  });
}

if (!mongoose.models.Payment) {
  PaymentSchema.plugin(AutoIncrement, {
    id: "payment_order",
    inc_field: "order",
    start_seq: 5000,
  });
}

const ModeOfPayment = mongoose.models.ModeOfPayment || mongoose.model("ModeOfPayment", ModeOfPaymentSchema);
const Payment = mongoose.models.Payment || mongoose.model("Payment", PaymentSchema);
const Refund = mongoose.models.Refund || mongoose.model("Refund", RefundSchema);

export { ModeOfPayment, Payment, Refund };