import Booking from '../models/bookingModel.js';
import Razorpay from 'razorpay';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import streamifier from 'streamifier';
import crypto from 'crypto';
import dotenv from 'dotenv';
import User from '../models/User.js';
import { Payment } from '../models/payment.js';
import { Refund } from '../models/payment.js';
import { ModeOfPayment } from '../models/payment.js';
dotenv.config();

// Razorpay Configuration
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Constants
const MAX_RETRIES = 3;
const UPLOAD_TIMEOUT_MS = 30000; // Increased to 30 seconds
const RETRY_DELAY_MS = 2000; // 2-second delay between retries

// Retry Utility for Cloudinary Upload with Timeout and Delay
const streamUploadWithRetry = async (fileBuffer, retries = MAX_RETRIES, timeoutMs = UPLOAD_TIMEOUT_MS) => {
  let attempt = 0;
  while (attempt < retries) {
    try {
      (`🔁 Cloudinary upload attempt ${attempt + 1} starting...`);
      return await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.error(`Cloudinary upload attempt ${attempt + 1} timed out after ${timeoutMs}ms`);
          reject(new Error('Cloudinary upload timeout'));
        }, timeoutMs);
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'manual_payments',
            resource_type: 'image',
          },
          (error, result) => {
            clearTimeout(timeout);
            if (result) {
              (`Cloudinary upload attempt ${attempt + 1} succeeded`);
              resolve(result);
            } else {
              console.error(`Cloudinary upload attempt ${attempt + 1} failed: ${error?.message || 'Unknown error'}`);
              reject(error);
            }
          }
        );
        streamifier.createReadStream(fileBuffer).pipe(stream);
      });
    } catch (err) {
      attempt++;
      if (attempt === retries) {
        throw new Error(`Cloudinary upload failed after ${retries} attempts: ${err.message}`);
      }
      console.warn(`Waiting ${RETRY_DELAY_MS}ms before retry ${attempt + 1}...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS)); // Delay before retry
    }
  }
};

// Multer Config with File Size Limit
const storage = multer.memoryStorage();
export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});



export const initiatePayment = async (req, res) => {
  try {
    const { bookingId, amount, paymentType = 'installment' } = req.body;

    // Validate required fields
    if (!bookingId || !amount) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        requiredFields: ["bookingId", "amount"],
        errorCode: "MISSING_FIELDS"
      });
    }

    // Fetch booking
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        message: "Booking not found",
        errorCode: "BOOKING_NOT_FOUND"
      });
    }

    // Check booking status
    if (booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: "Cannot process payment for cancelled booking",
        errorCode: "BOOKING_CANCELLED"
      });
    }

    // Validate amount
    const sanitizedAmount = Number(amount);
    if (isNaN(sanitizedAmount) || sanitizedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment amount",
        errorCode: "INVALID_AMOUNT"
      });
    }

    // Check remaining balance
    const remainingBalance = booking.budget - (booking.totalPaid || 0);
    if (sanitizedAmount > remainingBalance) {
      return res.status(400).json({
        success: false,
        message: `Payment amount (₹${sanitizedAmount}) exceeds remaining balance (₹${remainingBalance})`,
        maxAllowed: remainingBalance,
        errorCode: "AMOUNT_EXCEEDS_BALANCE"
      });
    }

    // Generate unique receipt ID
    const receiptId = `bk${bookingId.toString().slice(-12)}${Date.now().toString().slice(-6)}`;

    // Create Razorpay order
    let order;
    try {
      order = await razorpay.orders.create({
        amount: Math.round(sanitizedAmount * 100), // Convert to paise
        currency: 'INR',
        receipt: receiptId,
        payment_capture: 1,
        notes: [{
          bookingId: bookingId.toString(),
          type: paymentType
        }]
      });
    } catch (razorpayError) {
      const errorDetails = getPaymentErrorMessage(razorpayError);
      return res.status(400).json({
        success: false,
        message: errorDetails.message,
        userMessage: errorDetails.userMessage,
        errorCode: errorDetails.errorCode,
        errorDetails: process.env.NODE_ENV === 'development' ? razorpayError : undefined
      });
    }

    // Update booking with Razorpay order ID
    await Booking.findByIdAndUpdate(bookingId, {
      $set: { razorpayOrderId: order.id }
    });

    return res.status(200).json({
      success: true,
      order,
      remainingBalance: remainingBalance - sanitizedAmount,
      currency: 'INR'
    });
  } catch (error) {
    console.error("Payment initiation error:", error);
    const errorDetails = getPaymentErrorMessage(error);
    return res.status(500).json({
      success: false,
      message: errorDetails.message || "Payment initiation failed",
      userMessage: errorDetails.userMessage || "An unexpected error occurred during payment initiation.",
      errorCode: errorDetails.errorCode || "SERVER_ERROR",
      errorDetails: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


// Utility function to map Razorpay error codes to user-friendly messages
const getPaymentErrorMessage = (error) => {
  const errorCode = error?.error?.code || error?.code || 'UNKNOWN_ERROR';
  const errorDescription = error?.error?.description || error?.message || 'An unknown error occurred';

  const errorMap = {
    'BAD_REQUEST_ERROR': {
      message: 'Invalid payment details provided',
      userMessage: 'Please check your payment details and try again.',
      errorCode: 'INVALID_PAYMENT_DETAILS'
    },
    'GATEWAY_ERROR': {
      message: 'Payment gateway error',
      userMessage: 'There was an issue with the payment gateway. Please try again later.',
      errorCode: 'GATEWAY_ERROR'
    },
    'SERVER_ERROR': {
      message: 'Razorpay server error',
      userMessage: 'The payment service is temporarily unavailable. Please try again later.',
      errorCode: 'PAYMENT_SERVER_ERROR'
    },
    'PAYMENT_DECLINED': {
      message: 'Payment declined by bank',
      userMessage: 'Your payment was declined by your bank. Please contact your bank or try another payment method.',
      errorCode: 'PAYMENT_DECLINED'
    },
    'CARD_INVALID': {
      message: 'Invalid card details',
      userMessage: 'The card details provided are invalid. Please check the card number, expiry date, and CVV. For test mode, use card 4111 1111 1111 1111 with CVV 123 and a future expiry date.',
      errorCode: 'INVALID_CARD'
    },
    'INSUFFICIENT_BALANCE': {
      message: 'Insufficient funds',
      userMessage: 'Your account has insufficient funds. Please add funds or use another payment method.',
      errorCode: 'INSUFFICIENT_BALANCE'
    },
    'NETWORK_ERROR': {
      message: 'Network failure during payment',
      userMessage: 'A network error occurred during payment. Please check your internet connection and try again.',
      errorCode: 'NETWORK_ERROR'
    },
    'AUTHENTICATION_FAILED': {
      message: 'Payment authentication failed',
      userMessage: 'Payment authentication failed. Please verify your payment method or try another one.',
      errorCode: 'AUTHENTICATION_FAILED'
    },
    'INVALID_CARD_NUMBER': {
      message: 'Invalid card number provided',
      userMessage: 'The card number is invalid. For test mode, use 4111 1111 1111 1111 with CVV 123 and a future expiry date.',
      errorCode: 'INVALID_CARD'
    }
  };

  const mappedError = errorMap[errorCode] || {
    message: errorDescription,
    userMessage: `An unexpected error occurred during payment: ${errorDescription}. Please try again.`,
    errorCode: 'UNKNOWN_PAYMENT_ERROR'
  };

  if (!errorMap[errorCode]) {
    console.error('Unmapped Razorpay error:', error);
  }

  return mappedError;
};

// Helper function to get the next installment number
const getNextInstallmentNumber = async (bookingId) => {
  const payments = await Payment.find({ bookingId }).sort({ installmentNumber: -1 }).limit(1);
  return payments.length > 0 ? payments[0].installmentNumber + 1 : 1;
};

export const verifyPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId, paymentId, signature, bookingId, amount } = req.body;

    // Validate required fields
    if (!orderId || !paymentId || !signature || !bookingId || !amount) {
      await session.endSession();
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        userMessage: "Please provide all required payment details.",
        errorCode: "MISSING_FIELDS",
        requiredFields: ["orderId", "paymentId", "signature", "bookingId", "amount"]
      });
    }

    // Validate amount
    const sanitizedAmount = Number(amount);
    if (isNaN(sanitizedAmount) || sanitizedAmount <= 0) {
      await session.endSession();
      return res.status(400).json({
        success: false,
        message: "Invalid payment amount",
        userMessage: "Please enter a valid payment amount.",
        errorCode: "INVALID_AMOUNT"
      });
    }

    // Verify payment signature
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (generatedSignature !== signature) {
      await session.endSession();
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
        userMessage: "Payment verification failed due to invalid signature.",
        errorCode: "INVALID_SIGNATURE"
      });
    }

    // Check for duplicate payment
    const existingPayment = await Payment.findOne({ payId: paymentId }).session(session);
    if (existingPayment) {
      await session.abortTransaction();
      await session.endSession();
      return res.status(409).json({
        success: false,
        message: "Payment already processed",
        userMessage: "This payment has already been processed.",
        errorCode: "DUPLICATE_PAYMENT"
      });
    }

    // Fetch booking
    const booking = await Booking.findById(bookingId).session(session);
    if (!booking) {
      await session.endSession();
      return res.status(404).json({
        success: false,
        message: "Booking not found",
        userMessage: "The specified booking was not found.",
        errorCode: "BOOKING_NOT_FOUND"
      });
    }

    // Check remaining balance
    const remainingBalance = booking.budget - (booking.totalPaid || 0);
    if (sanitizedAmount > remainingBalance) {
      await session.endSession();
      return res.status(400).json({
        success: false,
        message: `Payment amount exceeds booking budget by ₹${sanitizedAmount - remainingBalance}`,
        userMessage: `The payment amount exceeds the remaining balance of ₹${remainingBalance}.`,
        maxAllowed: remainingBalance,
        errorCode: "AMOUNT_EXCEEDS_BALANCE"
      });
    }

    // Fetch and validate Razorpay payment
    let razorpayPayment;
    try {
      if (process.env.NODE_ENV === 'test' && paymentId.startsWith('pay_test_')) {
        razorpayPayment = {
          id: paymentId,
          status: 'captured',
          amount: Math.round(sanitizedAmount * 100),
          method: 'card',
          bank: 'TEST_BANK',
          wallet: null,
          captured_at: Math.floor(Date.now() / 1000)
        };
      } else {
        razorpayPayment = await razorpay.payments.fetch(paymentId);
        if (razorpayPayment.status !== 'captured') {
          const errorDetails = getPaymentErrorMessage({
            error: {
              code: razorpayPayment.error_code || 'PAYMENT_NOT_COMPLETED',
              description: razorpayPayment.error_description || `Payment not completed (status: ${razorpayPayment.status})`
            }
          });
          await session.endSession();
          return res.status(400).json({
            success: false,
            message: errorDetails.message,
            userMessage: errorDetails.userMessage,
            errorCode: errorDetails.errorCode,
            paymentStatus: razorpayPayment.status
          });
        }

        // Verify payment amount matches
        if (razorpayPayment.amount !== Math.round(sanitizedAmount * 100)) {
          await session.abortTransaction();
          await session.endSession();
          return res.status(400).json({
            success: false,
            message: `Payment amount mismatch: expected ₹${sanitizedAmount}, received ₹${razorpayPayment.amount / 100}`,
            userMessage: "The payment amount does not match the expected amount.",
            errorCode: "AMOUNT_MISMATCH"
          });
        }
      }
    } catch (razorpayError) {
      const errorDetails = getPaymentErrorMessage(razorpayError);
      await session.endSession();
      return res.status(400).json({
        success: false,
        message: errorDetails.message,
        userMessage: errorDetails.userMessage,
        errorCode: errorDetails.errorCode,
        errorDetails: process.env.NODE_ENV === 'development' ? razorpayError : undefined
      });
    }

    // Process payment
    const newTotalPaid = (booking.totalPaid || 0) + sanitizedAmount;
    const isFullPayment = newTotalPaid >= booking.budget;
    const isFirstPayment = (booking.totalPaid || 0) === 0;
    const paymentType = isFullPayment 
      ? (isFirstPayment ? 'full' : 'final')
      : (isFirstPayment ? 'deposit' : 'installment');
    const installmentNumber = await getNextInstallmentNumber(bookingId);

    // Create ModeOfPayment record
    const modeOfPayment = new ModeOfPayment({
      modeOfPayment: 'razorpay',
      bookingId: booking._id,
      details: {
        gateway: 'razorpay',
        orderId,
        paymentId,
        method: razorpayPayment.method,
        bank: razorpayPayment.bank,
        wallet: razorpayPayment.wallet,
        status: razorpayPayment.status,
        capturedAt: new Date(razorpayPayment.captured_at * 1000)
      }
    });

    // Create Payment record
    const payment = new Payment({
      modeOfPaymentId: modeOfPayment._id,
      bookingId: booking._id,
      amount: sanitizedAmount,
      paymentStatus: 'completed',
      paymentType,
      installmentNumber,
      isPartial: !isFullPayment,
      payId: paymentId, // Fixed: Use payId instead of paymentId
      customerResponse: razorpayPayment,
      completedAt: new Date()
    });

    // Update booking
    booking.totalPaid = newTotalPaid;
    booking.remainingBalance = Math.max(0, booking.budget - booking.totalPaid);
    booking.paymentStatus = isFullPayment ? 'paid' : 'partial';
    booking.razorpayOrderId = undefined;

    // Save records within transaction
    await modeOfPayment.save({ session });
    await payment.save({ session });
    await booking.save({ session });
    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message: "Payment verified and recorded",
      payment: {
        id: payment._id,
        amount: payment.amount,
        type: payment.paymentType,
        status: payment.paymentStatus,
        installmentNumber: payment.installmentNumber,
        remainingBalance: booking.remainingBalance,
        capturedAt: modeOfPayment.details.capturedAt
      },
      booking: {
        totalPaid: booking.totalPaid,
        paymentStatus: booking.paymentStatus,
        remainingBalance: booking.remainingBalance
      }
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Payment Verification Error:", error);
    const errorDetails = error.name === 'ValidationError' 
      ? {
          message: "Payment validation failed",
          userMessage: "Invalid payment data provided. Please try again.",
          errorCode: "VALIDATION_ERROR"
        }
      : getPaymentErrorMessage(error);
    return res.status(500).json({
      success: false,
      message: errorDetails.message || "Internal server error during verification",
      userMessage: errorDetails.userMessage || "An unexpected error occurred during payment verification.",
      errorCode: errorDetails.errorCode || "SERVER_ERROR",
      errorDetails: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    session.endSession();
  }
};



export const recordManualPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      bookingId,
      amount,
      paymentMethod,
      notes,
      bankName,
      accountLast4
    } = req.body;

    const normalizedMethod = paymentMethod.toLowerCase().trim();
    const validMethods = ['gpay', 'razorpay', 'cash', 'bank_transfer', 'phonepe', 'upi', 'other'];
    if (!validMethods.includes(normalizedMethod)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Invalid payment method '${paymentMethod}'. Valid options are: ${validMethods.join(', ')}`,
        errorCode: "INVALID_PAYMENT_METHOD"
      });
    }

    const sanitizedAmount = Number(amount);
    if (isNaN(sanitizedAmount) || sanitizedAmount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Invalid payment amount",
        errorCode: "INVALID_AMOUNT"
      });
    }

    const booking = await Booking.findById(bookingId).session(session);
    if (!booking) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Booking not found",
        errorCode: "BOOKING_NOT_FOUND"
      });
    }

    const remainingBalance = booking.budget - (booking.totalPaid || 0);
    if (sanitizedAmount > remainingBalance) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Amount (₹${sanitizedAmount}) exceeds remaining balance (₹${remainingBalance})`,
        maxAllowed: remainingBalance,
        errorCode: "AMOUNT_EXCEEDS_BALANCE"
      });
    }

    // Upload screenshot if exists, but proceed if it fails
    let screenshotUrl = null;
    if (req.file) {
      ('🔁 Uploading manual payment screenshot...');
      try {
        const uploadResult = await streamUploadWithRetry(req.file.buffer);
        screenshotUrl = uploadResult.secure_url;
      } catch (uploadError) {
        console.warn(`Screenshot upload failed: ${uploadError.message}. Proceeding without screenshot.`);
        // Optionally store the error in notes or a log
      }
    }

    const modeOfPayment = new ModeOfPayment({
      modeOfPayment: normalizedMethod,
      bookingId,
      details: {
        ...(normalizedMethod === "bank_transfer" && { bankName, accountLast4 }),
        notes,
      },
    });

    await modeOfPayment.save({ session });

    const payment = new Payment({
      modeOfPaymentId: modeOfPayment._id,
      bookingId,
      amount: sanitizedAmount,
      paymentStatus: "pending",
      date: new Date(),
      paymentType: remainingBalance - sanitizedAmount === 0 ? "full" : "installment",
      payId: `${normalizedMethod}_${Date.now()}`,
      customerResponse: { method: normalizedMethod, notes },
      transactionDetails: {
        ...(normalizedMethod === "bank_transfer" && { bankName, accountLast4 }),
        screenshotUrl: screenshotUrl || 'Upload failed',
      },
      recordedBy: req.user?.id,
    });

    booking.totalPaid = (booking.totalPaid || 0) + sanitizedAmount;
    booking.remainingBalance = Math.max(0, booking.budget - booking.totalPaid);
    booking.paymentStatus = booking.remainingBalance === 0 ? "paid" : "partial";

    await payment.save({ session });
    await booking.save({ session });
    await session.commitTransaction();

    res.status(200).json({
      success: true,
      bookingStatus: { ...booking.toObject() },
      message: screenshotUrl ? "Payment recorded with screenshot" : "Payment recorded without screenshot due to upload failure",
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Payment recording error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Payment recording failed",
      errorCode: "PAYMENT_RECORDING_FAILED"
    });
  } finally {
    session.endSession();
  }
};
export const getBookingPayments = async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID format",
        errorCode: "INVALID_BOOKING_ID"
      });
    }

    const payments = await Payment.find({ bookingId })
      .populate({
        path: 'modeOfPaymentId',
        select: 'modeOfPayment details screenshotUrl' // Populate modeOfPaymentId fields
      })
      .sort({ completedAt: 1 });

    const booking = await Booking.findById(bookingId)
      .select('budget totalPaid remainingBalance paymentStatus');

    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        message: "Booking not found",
        errorCode: "BOOKING_NOT_FOUND"
      });
    }

    const paymentTimeline = payments.map(p => ({
      id: p._id,
      amount: p.amount,
      type: p.paymentType,
      status: p.paymentStatus,
      paymentType: p.paymentType,
      method: p.modeOfPaymentId.modeOfPayment,
      date: p.completedAt,
      installmentNumber: p.installmentNumber,
      isPartial: p.isPartial,
      details: p.modeOfPaymentId.details,
      transactionId: p.payId,
      transactionDetails: {
        screenshotUrl: p.transactionDetails?.screenshotUrl || null // Nest screenshotUrl under transactionDetails
      }
    }));

    res.status(200).json({
      success: true,
      payments: paymentTimeline,
      summary: {
        totalBudget: booking.budget,
        totalPaid: booking.totalPaid,
        remainingBalance: booking.remainingBalance,
        paymentStatus: booking.paymentStatus,
        nextPaymentDue: booking.remainingBalance > 0 ? 
          `₹${booking.remainingBalance} pending` : 'Fully paid'
      }
    });
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment history",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      errorCode: "SERVER_ERROR"
    });
  }
};
export const updatePaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { paymentStatus, refundedAt, notes } = req.body;

    const validStatuses = ["completed", "pending", "failed", "refunded", "processed"];
    if (!validStatuses.includes(paymentStatus)) {
      return res.status(400).json({ error: "Invalid payment status value." });
    }

    const updateFields = {
      paymentStatus,
      ...(paymentStatus === 'refunded' && { refundedAt: new Date() }),
      ...(notes && { notes }),
    };

    const updatedPayment = await Payment.findByIdAndUpdate(
      paymentId,
      { $set: updateFields },
      { new: true }
    );

    if (!updatedPayment) {
      return res.status(404).json({ error: "Payment not found." });
    }

    return res.status(200).json({
      message: "Payment status updated successfully.",
      payment: updatedPayment,
    });
  } catch (error) {
    console.error("Error updating payment status:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
};

/**
 * @description Update payment status manually
 * @route PUT /:paymentId/status
 * @access Private (Admin/Manager)
 */
export const updateManualPaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { paymentStatus, notes } = req.body;

    // Validate payment status
    if (!paymentStatus || !["completed", "pending", "failed", "refunded", "processed"].includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment status provided"
      });
    }

    // Find the payment
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found"
      });
    }

    // Prepare update object
    const update = {
      paymentStatus,
      notes: notes || payment.notes,
    
    };

    // Set timestamps based on status
    if (paymentStatus === "completed" && payment.paymentStatus !== "completed") {
      update.completedAt = new Date();
    } else if (paymentStatus === "failed" && payment.paymentStatus !== "failed") {
      update.failedAt = new Date();
    } else if (paymentStatus === "refunded" && payment.paymentStatus !== "refunded") {
      update.refundedAt = new Date();
      
      // Create refund record if status is refunded
      await Refund.create({
        paymentId: payment._id,
        amountRefunded: payment.amount,
        status: "refunded",
        refundedAt: new Date()
      });
    }

    // Update the payment
    const updatedPayment = await Payment.findByIdAndUpdate(
      paymentId,
      update,
      { new: true }
    ).populate("modeOfPaymentId bookingId recordedBy");

    res.status(200).json({
      success: true,
      message: "Payment status updated successfully",
      payment: updatedPayment
    });

  } catch (error) {
    console.error("Error updating payment status:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

export const getUserPaymentDetails = async (req, res) => {
  const { userId } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format",
      });
    }

    const bookings = await Booking.find({ userId })
      .populate({
        path: "userId",
        select: "name email",
        model: User,
      })
      .select("startDate endDate budget paymentStatus status")
      .lean();

    if (!bookings || bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No bookings found for this user",
      });
    }

    const bookingIds = bookings.map(booking => booking._id);
    const payments = await Payment.find({ bookingId: { $in: bookingIds } })
      .populate({
        path: "modeOfPaymentId",
        select: "modeOfPayment details createdAt",
      })
      .sort({ createdAt: -1 })
      .lean();

    // ⬇️ Fetch refunds by bookingId, not paymentId
    const refunds = await Refund.find({ bookingId: { $in: bookingIds } })
      .select('-_id')
      .lean();

    const result = bookings.map(booking => {
      const bookingPayments = payments
        .filter(payment => payment.bookingId.toString() === booking._id.toString())
        .map(payment => ({
          amount: payment.amount,
          status: payment.paymentStatus,
          type: payment.paymentType,
          transactionId: payment.payId,
          createdAt: payment.createdAt,
          modeOfPayment: payment.modeOfPaymentId
            ? {
                type: payment.modeOfPaymentId.modeOfPayment,
                details: payment.modeOfPaymentId.details,
                createdAt: payment.modeOfPaymentId.createdAt,
              }
            : null,
        }));

      // ⬇️ Match refunds for the current booking
      const bookingRefunds = refunds
        .filter(refund => refund.bookingId.toString() === booking._id.toString())
        .map(refund => ({
          amount: refund.amount,
          status: refund.status,
          createdAt: refund.createdAt,
          proof: refund.proof,
          adminComment: refund.adminComment,
        }));

      const totalPaid = bookingPayments
        .filter(p => p.status === "completed")
        .reduce((sum, p) => sum + p.amount, 0);

      return {
        userName: booking.userId?.name || "Unknown User",
        userEmail: booking.userId?.email || "N/A",
        dateRange: `${new Date(booking.startDate).toLocaleDateString()} - ${new Date(booking.endDate).toLocaleDateString()}`,
        budget: booking.budget,
        totalPaid,
        remainingBalance: booking.budget - totalPaid,
        paymentStatus: booking.paymentStatus,
        status: booking.status,
        payments: bookingPayments,
        refunds: bookingRefunds, // Attach here at the booking level
      };
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error in getUserPaymentDetails:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};



export const getSinglePaymentDetails = async (req, res) => {
  const { paymentId } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(paymentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment ID format",
      });
    }

    const payment = await Payment.findById(paymentId)
      .populate({
        path: "modeOfPaymentId",
        select: "modeOfPayment details createdAt",
      })
      .lean();

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    const booking = await Booking.findById(payment.bookingId)
      .populate({
        path: "userId",
        select: "name email",
        model: User,
      })
      .select("email phone startDate endDate duration budget totalPaid remainingBalance paymentStatus status")
      .lean();

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Associated booking not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        payment: {
          amount: payment.amount,
          status: payment.paymentStatus,
          type: payment.paymentType,
          transactionId: payment.payId,
          installmentNumber: payment.installmentNumber,
          isPartial: payment.isPartial,
          createdAt: payment.createdAt,
          completedAt: payment.completedAt,
          notes: payment.notes,
        },
        booking: {
          userName: booking.userId?.name || "Unknown User",
          userEmail: booking.userId?.email || "N/A",
          email: booking.email,
          phone: booking.phone,
          startDate: booking.startDate,
          endDate: booking.endDate,
          duration: booking.duration,
          budget: booking.budget,
          totalPaid: booking.totalPaid,
          remainingBalance: booking.remainingBalance,
          paymentStatus: booking.paymentStatus,
          status: booking.status,
        },
        modeOfPayment: payment.modeOfPaymentId
          ? {
              type: payment.modeOfPaymentId.modeOfPayment,
              details: payment.modeOfPaymentId.details,
              createdAt: payment.modeOfPaymentId.createdAt,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Error in getSinglePaymentDetails:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
/**
 * @desc    Get all bookings and payments for a guide with enhanced filtering
 * @route   GET /api/payments/guide/:guideId
 * @access  Private (Guide only)
 */
export const getGuidePaymentHistory = async (req, res) => {
  try {
    const { guideId } = req.params;
    const { 
      page = 1, 
      limit = 10, 
      status, 
      paymentStatus, 
      startDate, 
      endDate,
      minAmount,
      maxAmount,
      paymentMethod 
    } = req.query;

    if (!mongoose.Types.ObjectId.isValid(guideId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid guide ID format",
        errorCode: "INVALID_GUIDE_ID"
      });
    }

    const guideObjectId = new mongoose.Types.ObjectId(guideId);

    const bookingQuery = { guideId: guideObjectId };

    if (status) {
      const statuses = status.split(',');
      bookingQuery.status = { $in: statuses.filter(s => 
        ['pending', 'confirmed', 'finalized', 'paid', 'completed', 'cancelled', 'refunded'].includes(s)
      )};
    }

    if (paymentStatus) {
      const statuses = paymentStatus.split(',');
      bookingQuery.paymentStatus = { $in: statuses.filter(ps => 
        ['unpaid', 'partial', 'paid', 'refunded'].includes(ps)
      )};
    }

    if (startDate || endDate) {
      bookingQuery.startDate = {};
      if (startDate) bookingQuery.startDate.$gte = new Date(startDate);
      if (endDate) bookingQuery.startDate.$lte = new Date(endDate);
    }

    const paymentPipeline = [
      {
        $lookup: {
          from: 'modeofpayments',
          localField: 'modeOfPaymentId',
          foreignField: '_id',
          as: 'paymentMethod'
        }
      },
      { $unwind: { path: '$paymentMethod', preserveNullAndEmptyArrays: true } }
    ];

    const paymentMatch = {};
    if (minAmount) paymentMatch.amount = { $gte: Number(minAmount) };
    if (maxAmount) paymentMatch.amount = { ...paymentMatch.amount, $lte: Number(maxAmount) };
    if (paymentMethod) {
      const methods = paymentMethod.split(',');
      paymentMatch['paymentMethod.modeOfPayment'] = { $in: methods };
    }

    if (Object.keys(paymentMatch).length > 0) {
      paymentPipeline.unshift({ $match: paymentMatch });
    }

    paymentPipeline.push(
      {
        $project: {
          _id: 1,
          amount: 1,
          date: '$createdAt',
          paymentStatus: 1,
          paymentType: 1,
          payId: 1,
          paymentMethod: '$paymentMethod.modeOfPayment',
          proofUrl: '$paymentMethod.details.proofUrl',
          transactionDetails: 1,
          notes: 1,
          recordedBy: 1
        }
      },
      { $sort: { date: -1 } }
    );

    const bookings = await Booking.aggregate([
      { $match: bookingQuery },
      { $sort: { startDate: -1 } },
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) },

      {
        $lookup: {
          from: 'payments',
          localField: '_id',
          foreignField: 'bookingId',
          as: 'payments',
          pipeline: paymentPipeline
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
          pipeline: [
            { $project: { 
              name: 1, 
              email: 1, 
              phone: 1,
              profilePicture: 1 
            } }
          ]
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },

      // Lookup guide (to get guide user ID)
      {
        $lookup: {
          from: 'users',
          localField: 'guideId',
          foreignField: '_id',
          as: 'guideUser'
        }
      },
      { $unwind: { path: '$guideUser', preserveNullAndEmptyArrays: true } },

      // Lookup guide's phone number from UserProfile
      {
        $lookup: {
          from: 'userprofile',
          localField: 'guideUser._id',
          foreignField: 'userId',
          as: 'guideProfile'
        }
      },
      { $unwind: { path: '$guideProfile', preserveNullAndEmptyArrays: true } },

      {
        $project: {
          _id: 1,
          bookingDate: 1,
          startDate: 1,
          endDate: 1,
          budget: 1,
          pickupLocation: 1,
          dropoffLocation: 1,
          status: 1,
          paymentStatus: 1,
          totalPaid: 1,
          remainingBalance: 1,
          activities: 1,
          razorpayOrderId: 1,
          createdAt: 1,
          user: 1,
          guidePhone: '$guideProfile.phoneNumber',
          payments: 1
        }
      }
    ]);

    const totalBookings = await Booking.countDocuments(bookingQuery);

    const formattedResponse = bookings.map(booking => ({
      bookingId: booking._id,
      bookingDate: booking.bookingDate,
      createdAt: booking.createdAt,
      pickupLocation: booking.pickupLocation,
      dropoffLocation: booking.dropoffLocation,
      tourDates: {
        start: booking.startDate,
        end: booking.endDate
      },
      budget: booking.budget,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      totalPaid: booking.totalPaid,
      remainingBalance: booking.remainingBalance,
      activities: booking.activities,
      customer: booking.user || null,
      guidePhone: booking.guidePhone || null,
      razorpayOrderId: booking.razorpayOrderId,
      payments: booking.payments.map(payment => ({
        paymentId: payment._id,
        amount: payment.amount,
        date: payment.date,
        status: payment.paymentStatus,
        type: payment.paymentType,
        method: payment.paymentMethod || 'unknown',
        proofUrl: payment.proofUrl || null,
        transactionId: payment.payId,
        notes: payment.notes,
        transactionDetails: payment.transactionDetails,
        recordedBy: payment.recordedBy
      }))
    }));

    res.status(200).json({
      success: true,
      totalBookings,
      totalPages: Math.ceil(totalBookings / parseInt(limit)),
      currentPage: parseInt(page),
      bookings: formattedResponse
    });

  } catch (error) {
    console.error("Error fetching guide bookings and payments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bookings and payments",
      errorCode: "FETCH_FAILED",
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack
      } : undefined
    });
  }
};

