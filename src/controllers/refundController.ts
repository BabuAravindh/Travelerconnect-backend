import { Refund, Payment } from "../models/payment.js";
import Razorpay from "razorpay";
import Booking from "../models/BookingModel.js";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import cloudinary from "cloudinary";
import dotenv from "dotenv";
import { promisify } from "util";
import fs from "fs";

dotenv.config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS 
  },
  tls: {
    rejectUnauthorized: false 
  }
});


const uploadImageToCloudinary = async (imagePath, retries = 5, initialDelay = 2000) => {
  try {
    const upload = promisify(cloudinary.v2.uploader.upload);
    const result = await upload(imagePath, {
      folder: "refunds",
      timeout: 60000, // Set a 60-second timeout for the upload
    });
    ("Cloudinary upload success:", result.secure_url);
    return result.secure_url;
  } catch (error) {
    console.error("Cloudinary upload error:", {
      message: error.message,
      stack: error.stack,
      retryCount: retries,
    });
    if (retries > 0) {
      const delay = initialDelay * (6 - retries); // Exponential backoff: 2s, 4s, 6s, 8s, 10s
      (`Retrying Cloudinary upload... Attempts left: ${retries}, Delay: ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return uploadImageToCloudinary(imagePath, retries - 1, initialDelay);
    }
    throw new Error(`Cloudinary upload failed after ${retries + 1} attempts: ${error.message}`);
  }
};

export const fetchAllRefunds = async (req, res) => {
  try {
    const refunds = await Refund.find()
      .populate({
        path: "bookingId",
        select: "amountRefunded status refundedAt createdAt userId",
        populate: {
          path: "userId",
          select: "name email role",
        },
      });

    res.status(200).json({ success: true, data: refunds });
  } catch (error) {
    console.error("Error fetching refunds:", error);
    res.status(500).json({ success: false, error: "Failed to fetch refunds" });
  }
};

export const createRefundRequest = async (req, res) => {
  const { bookingId, amount } = req.body;

  try {
    if (!mongoose.isValidObjectId(bookingId)) {
      return res.status(400).json({ success: false, error: "Invalid booking ID" });
    }

    const existingRefund = await Refund.findOne({ bookingId });
    if (existingRefund) {
      return res.status(400).json({
        success: false,
        error: "Refund request already exists for this booking",
      });
    }

    const refund = await Refund.create({ bookingId, amount });
    res.status(200).json({
      success: true,
      data: refund,
      message: "Refund request created successfully",
    });
  } catch (error) {
    console.error("Error creating refund request:", error);
    res.status(500).json({ success: false, error: "Error creating refund request" });
  }
};

export const updateRefundProof = async (req, res) => {
  try {
    ("Update refund proof request:", {
      params: req.params,
      body: req.body,
      file: req.file,
    });

    const { id } = req.params;
    let { adminComment } = req.body;

    if (!req.file) {
      ("No proof file provided");
      return res.status(400).json({ success: false, error: "Proof image is required" });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
    if (!allowedTypes.includes(req.file.mimetype)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, error: "Only JPEG, PNG, or GIF images allowed" });
    }

    // Validate file integrity
    try {
      await fs.promises.access(req.file.path, fs.constants.R_OK);
    } catch (error) {
      console.error("Invalid or inaccessible file:", error);
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, error: "Invalid or corrupted file" });
    }

    adminComment = adminComment.replace(/[<>"'&]/g, "");

    const localFilePath = req.file.path;
    let cloudinaryUrl;
    try {
      cloudinaryUrl = await uploadImageToCloudinary(localFilePath);
    } catch (error) {
      console.error("Cloudinary upload failed:", error);
      fs.unlinkSync(localFilePath);
      return res.status(500).json({
        success: false,
        error: "Failed to upload proof image to Cloudinary",
        details: error.message,
      });
    }

    fs.unlink(localFilePath, (err) => {
      if (err) console.error("Error deleting local file:", err);
    });

    const refund = await Refund.findById(id);
    if (!refund) {
      ("Refund not found for ID:", id);
      return res.status(404).json({ success: false, error: "Refund request not found" });
    }

    refund.proof = cloudinaryUrl;
    refund.adminComment = adminComment;
    refund.status = "refunded";
    refund.updatedAt = Date.now();
    await refund.save();
    ("Refund updated:", refund);

    const booking = await Booking.findById(refund.bookingId).populate("userId");
    if (!booking || !booking.userId) {
      ("Booking or user not found for refund:", refund.bookingId);
      return res.status(404).json({ success: false, error: "Booking or User not found" });
    }

    const user = booking.userId;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Refund Proof Submitted",
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Refund Proof Submitted</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
              background-color: #f4f4f9;
              color: #333;
            }
            .container {
              width: 100%;
              max-width: 600px;
              margin: 0 auto;
              background-color: #ffffff;
              padding: 20px;
              border-radius: 8px;
              box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            }
            .header {
              background-color: #007bff;
              color: #ffffff;
              text-align: center;
              padding: 15px 0;
              border-radius: 8px 8px 0 0;
            }
            .header h1 {
              margin: 0;
            }
            .content {
              margin-top: 20px;
              font-size: 16px;
            }
            .content p {
              line-height: 1.6;
            }
            .content .proof {
              margin-top: 15px;
              padding: 10px;
              background-color: #f9f9f9;
              border: 1px solid #ddd;
              border-radius: 4px;
            }
            .footer {
              margin-top: 30px;
              font-size: 14px;
              color: #777;
              text-align: center;
            }
            .footer a {
              color: #007bff;
              text-decoration: none;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Refund Processed</h1>
            </div>
            <div class="content">
              <p>Dear <strong>${user.name}</strong>,</p>
              <p>Your refund request for booking ID: <strong>${refund.bookingId}</strong> has been successfully processed. Below are the details:</p>
              <div class="proof">
                <p><strong>Admin Comment:</strong> ${adminComment}</p>
                <p><strong>Refund Proof:</strong></p>
                <p><a href="${cloudinaryUrl}" target="_blank">View refund proof</a></p>
              </div>
              <p>If you have any questions, feel free to reach out to us.</p>
              <p>Best regards,</p>
              <p>The TravelerConnect Team</p>
            </div>
            <div class="footer">
              <p><a href="https://www.travelerconnect.com">Visit our website</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      ("Email sent to:", user.email);
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
    }

    res.status(200).json({
      success: true,
      data: refund,
      message: "Refund proof submitted successfully",
    });
  } catch (error) {
    console.error("Error submitting refund proof:", error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      error: "Server error",
      details: error.message,
    });
  }
};