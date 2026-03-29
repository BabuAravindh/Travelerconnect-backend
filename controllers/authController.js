import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import validator from "validator";
import { body, validationResult } from "express-validator";
import crypto from "crypto";
import User from "../models/User.js";
import ResetPassword from "../models/ResetPassword.js";
import { emailVerificationTemplate } from "../utils/emailTemplate.js";
import UserProfile from "../models/UserProfile.js";
dotenv.config();

const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    tls: {
        rejectUnauthorized: false,
    },
});
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import Guide from '../models/Guide.js';
import cloudinary from '../config/cloudinary.js';

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: './tmp/uploads/',
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${uuidv4()}${ext}`);
    }
  }),
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|pdf/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images (JPEG/JPG/PNG) and PDFs are allowed'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Enhanced retry utility with timeout detection
const withRetry = async (fn, operationName = 'operation', maxRetries = 3, initialDelayMs = 1000) => {
  let lastError;
  let delayMs = initialDelayMs;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Add a timeout wrapper for Cloudinary operations
      if (operationName.includes('Cloudinary')) {
        return await Promise.race([
          fn(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`${operationName} timeout`)), 20000)
          )
        ]);
      }
      return await fn();
    } catch (error) {
      lastError = error;
      console.error(`Attempt ${i + 1} failed for ${operationName}:`, error.message);
      
      if (i < maxRetries - 1) {
        const waitTime = delayMs * (i + 1);
        (`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  console.error(`All ${maxRetries} attempts failed for ${operationName}`);
  throw lastError;
};

// Cloudinary connection check
const checkCloudinaryConnection = async () => {
  try {
    await cloudinary.api.ping();
    return true;
  } catch (error) {
    console.error('Cloudinary connection check failed:', error);
    return false;
  }
};
export const uploadGovernmentIdAndBecomeGuide = async (req, res) => {
  let uploadResult = null;
  (req.file)
  try {
    // 1. Validate request contains file
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: 'No file uploaded' 
      });
    }

    const governmentIdFile = req.file;
    const userId = req.body.userId;

    // 2. Validate file type and size (already partially handled by Multer)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(governmentIdFile.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Only JPG, PNG, or PDF files are allowed'
      });
    }

    // 3. Check Cloudinary connection
    const isCloudinaryAvailable = await checkCloudinaryConnection();
    if (!isCloudinaryAvailable) {
      return res.status(503).json({
        success: false,
        message: 'File storage service is temporarily unavailable'
      });
    }

    // 4. Upload to Cloudinary
    uploadResult = await withRetry(async () => {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'government_ids',
            resource_type: 'auto',
            allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
            transformation: [{ quality: 'auto:good' }, { flags: 'attachment' }]
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );

        uploadStream.on('error', reject);
        uploadStream.end(governmentIdFile.buffer);
      });
    }, 'Cloudinary upload', 3, 1500);

    // 5. Update database records
    const [updatedGuide, updatedUser] = await withRetry(async () => {
      return Promise.all([
        Guide.findOneAndUpdate(
          { userId },
          {
            aadharCardPhoto: {
              public_id: uploadResult.public_id,
              url: uploadResult.url,
              secure_url: uploadResult.secure_url,
              uploadedAt: new Date()
            },
            verificationStatus: 'pending'
          },
          { new: true, upsert: true }
        ),
        User.findByIdAndUpdate(
          userId,
          {
            $set: { role: 'guide' },
            $push: {
              roleHistory: {
                role: 'guide',
                changedAt: new Date(),
                changedBy: 'system',
                reason: 'Government ID uploaded'
              }
            }
          },
          { new: true }
        )
      ]);
    }, 'Database update');
    

    // 6. Send success response
    
    return res.status(200).json({
      success: true,
      message: 'Government ID uploaded and guide role activated',
      data: {
        guide: updatedGuide,
        user: {
          _id: updatedUser._id,
          name: updatedUser.name,
          role: updatedUser.role
        },
        document: {
          url: uploadResult.secure_url,
          uploadedAt: new Date(),
          
        }
      }
    });

  } catch (error) {
    console.error('Upload process failed:', error);

    // Cleanup Cloudinary upload if it was successful
    if (uploadResult?.public_id) {
      try {
        await cloudinary.uploader.destroy(uploadResult.public_id);
      } catch (cleanupError) {
        console.error('Cloudinary cleanup failed:', cleanupError);
      }
    }

    // Handle specific errors
    if (error.message.includes('timeout') || error.name === 'TimeoutError') {
      return res.status(504).json({
        success: false,
        message: 'Operation timed out. Please try again with a smaller file.'
      });
    }

    if (error.http_code) {
      return res.status(502).json({
        success: false,
        message: 'File storage service error. Please try again later.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack
      } : undefined
    });
  }
};

const verifiedResetSessions = new Map();

export const signup = async (req, res) => {
  try {
    ("✅ Received Data:", req.body);
    const { name, email, password, confirmPassword } = req.body;

    // Initialize errors array
    const errors = [];

    // Validate required fields
    if (!name || !name.trim()) {
      errors.push({ field: "name", message: "Name is required" });
    }
    if (!email) {
      errors.push({ field: "email", message: "Email is required" });
    }
    if (!password) {
      errors.push({ field: "password", message: "Password is required" });
    }
    if (!confirmPassword) {
      errors.push({ field: "confirmPassword", message: "Please confirm your password" });
    }

    // Validate email format
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (email && !emailRegex.test(email)) {
      errors.push({ field: "email", message: "Enter a valid email address" });
    }

    // Validate password strength
    const strongPasswordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (password && !strongPasswordRegex.test(password)) {
      errors.push({
        field: "password",
        message:
          "Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character (e.g., @$!%*?&)",
      });
    }

    // Validate password confirmation
    if (password && confirmPassword && password !== confirmPassword) {
      errors.push({ field: "confirmPassword", message: "Passwords do not match" });
    }

    // If there are validation errors, return them
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    // Check for existing email (case-insensitive)
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({
        errors: [{ field: "email", message: "This email is already registered" }],
      });
    }

    // Check for existing name (case-insensitive, trimmed)
    const trimmedName = name.trim();
    const existingName = await User.findOne({
      name: { $regex: `^${trimmedName}$`, $options: "i" },
    });
    if (existingName) {
      return res.status(400).json({
        errors: [{ field: "name", message: "This name is already taken" }],
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");

    // Create new user
    const newUser = new User({
      name: trimmedName,
      email: email.toLowerCase(),
      password: hashedPassword,
      isVerified: false,
      verificationToken,
      role: "user",
    });
    await newUser.save();

    // Send verification email (async, non-blocking)
    const verificationUrl = `${process.env.CLIENT_URL}/verify-mail/${verificationToken}`;
    transporter
      .sendMail({
        from: `"TravelerConnect" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Verify Your Email - TravelerConnect",
        html: emailVerificationTemplate(verificationUrl),
      })
      .catch((err) => console.error("Email sending failed:", err));

    // Send success response without token
    res.status(201).json({
      message: "User registered successfully. Please verify your email.",
      user: { id: newUser._id, name: newUser.name, role: newUser.role },
    });
  } catch (error) {
    console.error("❌ Signup Error:", error);
    const errorMessage = error.message || "Server error";
    return res.status(500).json({ errors: [{ field: "", message: errorMessage }] });
  }
};

export const signupGuide = async (req, res) => {
  try {
    ("✅ Received Guide Data:", req.body);
    const { name, email, password } = req.body;
    const role = "guide"; // Force the role to guide, no matter what

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check for existing email or name
    const existingEmail = await User.findOne({ email });
    if (existingEmail)
      return res.status(400).json({ message: "User with this email already exists" });

    const existingName = await User.findOne({ name });
    if (existingName)
      return res.status(400).json({
        info: "This name is already taken. Please choose a different name.",
        isNameTaken: true,
      });

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString("hex");

    const newGuide = new User({
      name,
      email,
      password: hashedPassword,
      isVerified: false,
      verificationToken,
      role,
    });

    await newGuide.save();
    ("🟢 Saved new guide:", newGuide);

    const verificationUrl = `${process.env.CLIENT_URL}/guides/guide-verify-mail/${verificationToken}`;
    await transporter.sendMail({
      from: `"TravelerConnect" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verify Your Email - TravelerConnect",
      html: emailVerificationTemplate(verificationUrl),
    });

    return res.status(201).json({
      message:
        "Guide registered successfully. Please check your email to verify your account.",
    });
  } catch (error) {
    console.error("❌ Signup Guide Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};





export const resendVerificationEmail = async (req, res) => {
  try {
      const { email } = req.body;

      if (!email) return res.status(400).json({ message: "Email is required" });

      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ message: "User not found" });

      if (user.isVerified) {
          return res.status(400).json({ message: "Email is already verified" });
      }

      const newVerificationToken = crypto.randomBytes(32).toString("hex");
      user.verificationToken = newVerificationToken;
      await user.save();

      const verificationUrl = `${process.env.CLIENT_URL}/verify-mail/${newVerificationToken}`;

      await transporter.sendMail({
          from: `"TravelerConnect" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: "Verify Your Email - TravelerConnect",
          html: emailVerificationTemplate(verificationUrl),
      });

      res.status(200).json({ message: "Verification email sent successfully." });
  } catch (error) {
      console.error("❌ Resend Verification Error:", error);
      res.status(500).json({
          message: "Server error",
          error: process.env.NODE_ENV === "development" ? error.message : undefined,
      });
  }
};
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({ verificationToken: token });
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    // Verify user
    user.isVerified = true;
    user.verificationToken = null;
    await user.save();

    // Generate JWT token
    const jwtToken = jwt.sign(
      { id: user._id, name: user.name, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Send success response with token
    res.status(200).json({
      message: "Email verified successfully!",
      token: jwtToken,
      user: { id: user._id, name: user.name, role: user.role },
    });

  } catch (error) {
    console.error("❌ Email Verification Error:", error);
    res.status(500).json({
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Please enter a valid email and password" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.role !== 'user' && user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied. Only users can log in from this route." });
    }

    if (!user.isVerified) {
      return res.status(401).json({ error: "Please verify your email before logging in" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // ✅ Fetch UserProfile using user._id
    const userProfile = await UserProfile.findOne({ userId: user._id });

    const token = jwt.sign(
      { id: user._id.toString(), name: user.name, role: user.role, phone: userProfile?.phoneNumber || null ,email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(200).json({
      message: "Login successful",
      user: {
        _id: user._id,
        name: user.name,
        role: user.role,
        phone: userProfile?.phoneNumber || null, // ✅ add phone from profile
      },
      token,
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const Guidelogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Please enter a valid email and password" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // ✅ Check if the role is 'user'
    if (user.role !== 'guide') {
      return res.status(403).json({ error: "Access denied. Only Guides can log in from this route." });
    }

    if (!user.isVerified) {
      return res.status(401).json({ error: "Please verify your email before logging in" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id.toString(), name: user.name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

  res.status(200).json({
  message: "Login successful",
  user: { _id: user._id, name: user.name, role: user.role, govIdVerified: user.govIdVerified },
  token,
  redirectUrl: user.govIdVerified ? `${process.env.CLIENT_URL}` : `${process.env.CLIENT_URL}/guides/upload-id`
});

  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};





export const verifyGuideEmail = async (req, res) => {
  try {
      const { token } = req.params;
      
      // 1. Find guide by verification token
      const guide = await User.findOne({ 
          verificationToken: token,
          role: 'guide' // Ensure we're verifying a guide account
      });
      
      if (!guide) {
          return res.status(400).json({ 
              message: "Invalid or expired token",
              code: "INVALID_TOKEN"
          });
      }

      // 2. Check if guide is already verified
      if (guide.isVerified) {
          return res.status(200).json({ 
              message: "Guide email already verified",
              code: "ALREADY_VERIFIED",
              redirectUrl: guide.govIdVerified ? "/guide-dashboard" : "/guide/upload-id"
          });
      }

      // 3. Update verification status
      guide.isVerified = true;
      guide.verificationToken = null;
      guide.verificationDate = new Date();
      
      await guide.save();

      // 4. Generate JWT token
      const jwtToken = jwt.sign(
          { id: guide._id, name: guide.name, email: guide.email, role: guide.role },
          process.env.JWT_SECRET,
          { expiresIn: "7d" }
      );

      // 5. Check if government ID needs to be uploaded
      const requiresIdUpload = !guide.govIdVerified && !guide.govIdPath;
       ( {         token: jwtToken, // Include the JWT token in the response
        user: { id: guide._id, name: guide.name, role: guide.role }, // Include user details
        requiresIdUpload,
        redirectUrl: requiresIdUpload ? "/guides/upload-id" : "/guide-dashboard"})
      res.status(200).json({
          message: "Guide email verified successfully!",
          code: "VERIFICATION_SUCCESS",
          token: jwtToken, // Include the JWT token in the response
          user: { id: guide._id, name: guide.name, role: guide.role }, // Include user details
          requiresIdUpload,
          redirectUrl: requiresIdUpload ? "/guides/upload-id" : "/guide-dashboard"
      });

  } catch (error) {
      console.error("❌ Guide Email Verification Error:", error);
      res.status(500).json({ 
          message: "Server error during guide verification",
          code: "SERVER_ERROR",
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
  }
};

export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: "Email is required" });
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(404).json({ message: "User not found" });

        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiryTime = Date.now() + 10 * 60 * 1000;

        await ResetPassword.create({ userId: user._id, email: user.email, resetPasswordCode: resetCode, resetPasswordExpires: expiryTime });
        await transporter.sendMail({ from: `"TravelerConnect" <${process.env.EMAIL_USER}>`, to: user.email, subject: "Password Reset Code", text: `Your reset code: ${resetCode}` });
        res.status(200).json({ message: "Reset code sent to email" });
    } catch (error) {
        console.error("❌ Forgot Password Error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const resetPassword = async (req, res) => {
    try {
        const { newPassword } = req.body;
        const validUserId = [...verifiedResetSessions.keys()].find(userId => verifiedResetSessions.get(userId) > Date.now());
        if (!validUserId) return res.status(400).json({ message: "Reset session expired or invalid" });

        verifiedResetSessions.delete(validUserId);
        const user = await User.findById(validUserId);
        if (!user) return res.status(404).json({ message: "User not found" });

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();
        res.status(200).json({ message: "Password reset successfully" });
    } catch (error) {
        console.error("❌ Reset Password Error:", error);
        res.status(500).json({ message: "Server error" });
    }
};
// 🔹 Verify Reset Code Controller
 export const verifyResetCode = async (req, res) => {
    try {
        const { otp } = req.body;
        if (!otp) {
            return res.status(400).json({ message: "Reset code is required" });
        }

        // Find the most recent valid reset code
        const resetRequest = await ResetPassword.findOne({ resetPasswordCode: otp })
            .sort({ resetPasswordExpires: -1 });

        if (!resetRequest || resetRequest.resetPasswordExpires < Date.now()) {
            return res.status(400).json({ message: "Invalid or expired reset code" });
        }

        // Store userId in temporary storage
        verifiedResetSessions.set(resetRequest.userId.toString(), Date.now() + 10 * 60 * 1000); // 10 minutes expiry

        res.status(200).json({ message: "Code verified successfully" });
    } catch (error) {
        console.error("❌ Verify Code Error:", error);
        res.status(500).json({ message: "Server error" });
    }
};
export const validateName = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ status: 'error', message: "Please enter a name to proceed." });

    const existingUser = await User.findOne({ name });
    if (existingUser) {
      return res.status(200).json({
        status: 'info',
        message: "This name is already taken. Please try a different one."
      });
    }

    res.status(200).json({ status: 'success', message: "Great! This name is available for use." });
  } catch (error) {
    console.error("❌ Validate Name Error:", error);
    res.status(500).json({ status: 'error', message: "Oops! Something went wrong on our end. Please try again later." });
  }
};
export const validateEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ status: 'error', message: "Please enter an email to proceed." });

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        status: 'info',
        message: "This email is already registered. Please use a different one."
      });
    }

    res.status(400).json({ status: 'info', message: "Wonderful! This email is available for signup." });
  } catch (error) {
    console.error("❌ Validate Email Error:", error);
    res.status(500).json({ status: 'error', message: "Oops! Something went wrong on our end. Please try again later." });
  }
};
