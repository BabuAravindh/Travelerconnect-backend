// services/authService.ts  (your existing file — just add these)

import bcrypt       from "bcryptjs";
import crypto       from "crypto";
import User         from "../../models/User.js";
import UserProfile  from "../../models/UserProfile.js";
import ResetPassword from "../../models/ResetPassword.js";
import { generateToken }           from "../../utils/tokenService.js";
import { sendVerificationEmail }   from "../Email/emailService.js";
import { roleConfig } from "../../constants/auth/authConfig.js";
import Guide      from "../../models/Guide.js";
import cloudinary from "../../config/cloudinary.js";


// ─── SIGNUP LOGIC ─────────────────────────────────────
export const signupUser = async (body: any, role: "user" | "guide") => {
  const { name, email, password } = body;

  const [existingEmail, existingName] = await Promise.all([
    User.findOne({ email: email.toLowerCase() }),
    User.findOne({ name: { $regex: `^${name?.trim()}$`, $options: "i" } }),
  ]);

  if (existingEmail) throw { status: 400, field: "email",  message: "Email already registered" };
  if (existingName)  throw { status: 400, field: "name",   message: "Name already taken" };

  const hashedPassword    = await bcrypt.hash(password, 10);
  const verificationToken = crypto.randomBytes(32).toString("hex");

  const newUser = await User.create({
    name: name.trim(),
    email: email.toLowerCase(),
    password: hashedPassword,
    isVerified: false,
    verificationToken,
    role,
  });

  await sendVerificationEmail(
    newUser.email,
    verificationToken,
    roleConfig[role].verifyUrlPath
  );

  return { id: newUser._id, name: newUser.name, role: newUser.role };
};

// ─── LOGIN LOGIC ──────────────────────────────────────
export const loginUser = async (email: string, password: string, role: "user" | "guide") => {
  const user = await User.findOne({ email });
  if (!user) throw { status: 401, message: "Invalid credentials" };

  const config = roleConfig[role];
  if (!config.allowedRoles.includes(user.role))
    throw { status: 403, message: `Access denied. ${config.loginDeniedMsg}` };

  if (!user.isVerified)
    throw { status: 401, message: "Please verify your email before logging in" };

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw { status: 401, message: "Invalid credentials" };

  const userProfile = role === "user"
    ? await UserProfile.findOne({ userId: user._id })
    : null;

  const token = generateToken({
    id:    user._id.toString(),
    name:  user.name,
    role:  user.role,
    email: user.email,
    ...(userProfile ? { phone: userProfile.phoneNumber || null } : {}),
  });

  return { user, token, userProfile };
};

// ─── VERIFY EMAIL LOGIC ───────────────────────────────
export const verifyUserEmail = async (token: string, role: "user" | "guide") => {
  const query: any = { verificationToken: token };
  if (role === "guide") query.role = "guide";

  const user = await User.findOne(query);
  if (!user) throw { status: 400, message: "Invalid or expired token" };

  if (user.isVerified) return { alreadyVerified: true, user };

  user.isVerified        = true;
  user.verificationToken = null as any;
  if (role === "guide") (user as any).verificationDate = new Date();
  await user.save();

  const jwtToken = generateToken({
    id: user._id, name: user.name, email: user.email, role: user.role,
  });

  return { alreadyVerified: false, user, jwtToken };
};

// ─── RESEND VERIFICATION LOGIC ────────────────────────
export const resendVerification = async (email: string) => {
  const user = await User.findOne({ email });
  if (!user)           throw { status: 404, message: "User not found" };
  if (user.isVerified) throw { status: 400, message: "Email already verified" };

  user.verificationToken = crypto.randomBytes(32).toString("hex");
  await user.save();

  const role = user.role === "guide" ? "guide" : "user" as "user" | "guide";
  await sendVerificationEmail(email, user.verificationToken, roleConfig[role].verifyUrlPath);
};

// ─── FORGOT PASSWORD LOGIC ────────────────────────────
export const handleForgotPassword = async (email: string) => {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) throw { status: 404, message: "User not found" };

  const resetCode  = Math.floor(100000 + Math.random() * 900000).toString();
  const expiryTime = Date.now() + 10 * 60 * 1000;

  await ResetPassword.create({
    userId: user._id, email: user.email,
    resetPasswordCode: resetCode,
    resetPasswordExpires: expiryTime,
  });

  return { email: user.email, resetCode };
};

// ─── VERIFY RESET CODE LOGIC ──────────────────────────
export const verifyResetOtp = async (otp: string) => {
  const resetRequest = await ResetPassword
    .findOne({ resetPasswordCode: otp })
    .sort({ resetPasswordExpires: -1 });

  if (!resetRequest || resetRequest.resetPasswordExpires.getTime() < Date.now())
    throw { status: 400, message: "Invalid or expired reset code" };

  return resetRequest.userId.toString();
};

// ─── RESET PASSWORD LOGIC ─────────────────────────────
export const resetUserPassword = async (userId: string, newPassword: string) => {
  const user = await User.findById(userId);
  if (!user) throw { status: 404, message: "User not found" };

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();
};

// ─── VALIDATE FIELD LOGIC ─────────────────────────────
export const validateField = async (field: "name" | "email", value: string) => {
  const exists = await User.findOne({ [field]: value });
  if (exists) throw { status: 400, field, message: `This ${field} is already taken.` };
};


// ─── UPLOAD GOVERNMENT ID LOGIC ───────────────────────
export const uploadGovernmentId = async (file: any, userId: string) => {

  // 1. Check Cloudinary connection
  const isAvailable = await cloudinary.api.ping().then(() => true).catch(() => false);
  if (!isAvailable) throw { status: 503, message: "File storage service is temporarily unavailable" };

  // 2. Upload to Cloudinary with retry
  let uploadResult: any = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      uploadResult = await Promise.race([
        new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder:        "government_ids",
              resource_type: "auto",
              allowed_formats: ["jpg", "jpeg", "png", "pdf"],
              transformation: [{ quality: "auto:good" }, { flags: "attachment" }],
            },
            (error, result) => (error ? reject(error) : resolve(result))
          );
          stream.end(file.buffer);
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Cloudinary upload timeout")), 20000)
        ),
      ]);
      break; // success — exit retry loop
    } catch (err: any) {
      if (attempt === 3) throw { status: 502, message: "File upload failed after retries", raw: err };
      await new Promise((r) => setTimeout(r, 1500 * attempt)); // backoff
    }
  }

  // 3. Update DB — Guide + User in parallel
  const [updatedGuide, updatedUser] = await Promise.all([
    Guide.findOneAndUpdate(
      { userId },
      {
        aadharCardPhoto: {
          public_id:  uploadResult.public_id,
          url:        uploadResult.url,
          secure_url: uploadResult.secure_url,
          uploadedAt: new Date(),
        },
        verificationStatus: "pending",
      },
      { new: true, upsert: true }
    ),
    User.findByIdAndUpdate(
      userId,
      {
        $set:  { role: "guide" },
        $push: {
          roleHistory: {
            role:      "guide",
            changedAt: new Date(),
            changedBy: "system",
            reason:    "Government ID uploaded",
          },
        },
      },
      { new: true }
    ),
  ]);

  return { uploadResult, updatedGuide, updatedUser };
};

// ─── CLEANUP CLOUDINARY ON FAILURE ────────────────────
export const cleanupCloudinaryUpload = async (publicId: string) => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error("Cloudinary cleanup failed:", err);
  }
};