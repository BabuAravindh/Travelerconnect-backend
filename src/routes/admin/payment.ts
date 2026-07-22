import { Payment, Refund } from "../../models/payment.js";
import Booking from "../../models/BookingModel.js";
import express from "express";
import mongoose from "mongoose";

const router = express.Router();

// Admin route to get all payments with formatted response
router.get("/", async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate({
        path: 'bookingId',
        select: 'order status',
        populate: [
          {
            path: 'userId',
            select: 'name email'
          },
          {
            path: 'guideId',
            select: 'name email'
          }
        ]
      })
      .populate('modeOfPaymentId', 'modeOfPayment')
      .sort('-createdAt');

    // Format the response
    const formattedPayments = payments.map(payment => ({
      id: payment._id,
      orderNumber: payment.order,
      amount: payment.amount,
      status: payment.paymentStatus,
      paymentMethod: payment.modeOfPaymentId?.modeOfPayment || 'Unknown',
      paymentId: payment.payId,
      completedAt: payment.completedAt,
      refundedAt: payment.refundedAt,
      booking: {
        id: payment.bookingId?._id,
        order: payment.bookingId?.order,
        status: payment.bookingId?.status,
        user: payment.bookingId?.userId ? {
          id: payment.bookingId.userId._id,
          name: payment.bookingId.userId.name,
          email: payment.bookingId.userId.email
        } : null,
        guide: payment.bookingId?.guideId ? {
          id: payment.bookingId.guideId._id,
          name: payment.bookingId.guideId.name,
          email: payment.bookingId.guideId.email
        } : null
      },
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt
    }));

    res.json({ 
      success: true, 
      count: formattedPayments.length,
      payments: formattedPayments 
    });
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Admin route to delete a payment
router.delete("/:paymentId", async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { paymentId } = req.params;

    // Validate payment ID
    if (!mongoose.Types.ObjectId.isValid(paymentId)) {
      await session.abortTransaction();
      return res.status(400).json({ 
        success: false, 
        message: "Invalid payment ID format" 
      });
    }

    // Find the payment
    const payment = await Payment.findById(paymentId).session(session);
    if (!payment) {
      await session.abortTransaction();
      return res.status(404).json({ 
        success: false, 
        message: "Payment not found" 
      });
    }

    // Check if payment has refunds
    const refunds = await Refund.find({ paymentId: payment._id }).session(session);
    if (refunds.length > 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Cannot delete payment with associated refunds"
      });
    }

    // Check if payment is completed or refunded
    if (['completed', 'refunded'].includes(payment.paymentStatus)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Cannot delete payment with status '${payment.paymentStatus}'`
      });
    }

    // Delete the payment
    await Payment.deleteOne({ _id: payment._id }).session(session);

    // Update booking status if needed
    if (payment.bookingId) {
      await Booking.findByIdAndUpdate(
        payment.bookingId,
        { $set: { status: 'cancelled' } },
        { session }
      );
    }

    await session.commitTransaction();
    res.json({ 
      success: true, 
      message: "Payment deleted successfully" 
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error deleting payment:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to delete payment",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    session.endSession();
  }
});

export default router;