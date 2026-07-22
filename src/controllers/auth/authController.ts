// controllers/authController.ts
import * as AuthService from "../../services/auth/auth.service";
import { validateSignupFields } from "../../validations/authValidation.js";
import { sendEmail } from "../../services/Email/emailService";

const verifiedResetSessions = new Map<string, number>();

// ─── SIGNUP ───────────────────────────────────────────
const handleSignup = (role: "user" | "guide") => async (req: any, res: any) => {
  try {
    if (role === "user") {
      const errors = validateSignupFields(req.body);
      if (errors.length) return res.status(400).json({ errors });
    } else {
      const { name, email, password } = req.body;
      if (!name || !email || !password)
        return res.status(400).json({ message: "All fields are required" });
    }

    const user = await AuthService.signupUser(req.body, role);
    return res.status(201).json({ message: "Registered successfully. Please verify your email.", user });

  } catch (err: any) {
    if (err.status) return res.status(err.status).json({ errors: [{ field: err.field, message: err.message }] });
    return res.status(500).json({ message: "Server error" });
  }
};

export const signup = handleSignup("user");
export const signupGuide = handleSignup("guide");

// ─── LOGIN ────────────────────────────────────────────
const handleLogin = (role: "user" | "guide") => async (req: any, res: any) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required" });

    const { user, token, userProfile } = await AuthService.loginUser(email, password, role);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        _id: user._id,
        name: user.name,
        role: user.role,
        ...(role === "user" ? { phone: userProfile?.phoneNumber || null } : {}),
        ...(role === "guide" ? { govIdVerified: user.govIdVerified } : {}),
      },
      ...(role === "guide" ? {
        redirectUrl: user.govIdVerified
          ? process.env.CLIENT_URL
          : `${process.env.CLIENT_URL}/guides/upload-id`,
      } : {}),
    });

  } catch (err: any) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const login = handleLogin("user");
export const Guidelogin = handleLogin("guide");

// ─── VERIFY EMAIL ─────────────────────────────────────
const handleVerifyEmail = (role: "user" | "guide") => async (req: any, res: any) => {
  try {
    const { alreadyVerified, user, jwtToken } = await AuthService.verifyUserEmail(req.params.token, role);

    if (alreadyVerified)
      return res.status(200).json({ message: "Email already verified" });

    return res.status(200).json({
      message: "Email verified successfully!",
      token: jwtToken,
      user: { id: user._id, name: user.name, role: user.role },
      ...(role === "guide" ? {
        requiresIdUpload: !(user as any).govIdVerified,
        redirectUrl: !(user as any).govIdVerified ? "/guides/upload-id" : "/guide-dashboard",
      } : {}),
    });

  } catch (err: any) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    return res.status(500).json({ message: "Server error" });
  }
};

export const verifyEmail = handleVerifyEmail("user");
export const verifyGuideEmail = handleVerifyEmail("guide");

// ─── RESEND VERIFICATION ──────────────────────────────
export const resendVerificationEmail = async (req: any, res: any) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    await AuthService.resendVerification(email);
    return res.status(200).json({ message: "Verification email sent successfully." });

  } catch (err: any) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    return res.status(500).json({ message: "Server error" });
  }
};

// ─── FORGOT PASSWORD ──────────────────────────────────
export const forgotPassword = async (req: any, res: any) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const { email: userEmail, resetCode } = await AuthService.handleForgotPassword(email);
    await sendEmail(userEmail, "Password Reset Code", `Your reset code: ${resetCode}`);

    return res.status(200).json({ message: "Reset code sent to email" });

  } catch (err: any) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    return res.status(500).json({ message: "Server error" });
  }
};

// ─── VERIFY RESET CODE ────────────────────────────────
export const verifyResetCode = async (req: any, res: any) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ message: "Reset code is required" });

    const userId = await AuthService.verifyResetOtp(otp);
    verifiedResetSessions.set(userId, Date.now() + 10 * 60 * 1000);

    return res.status(200).json({ message: "Code verified successfully" });

  } catch (err: any) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    return res.status(500).json({ message: "Server error" });
  }
};

// ─── RESET PASSWORD ───────────────────────────────────
export const resetPassword = async (req: any, res: any) => {
  try {
    const { newPassword } = req.body;
    const validUserId = [...verifiedResetSessions.keys()]
      .find(id => verifiedResetSessions.get(id)! > Date.now());

    if (!validUserId)
      return res.status(400).json({ message: "Reset session expired or invalid" });

    verifiedResetSessions.delete(validUserId);
    await AuthService.resetUserPassword(validUserId, newPassword);

    return res.status(200).json({ message: "Password reset successfully" });

  } catch (err: any) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    return res.status(500).json({ message: "Server error" });
  }
};

// ─── VALIDATE NAME / EMAIL ────────────────────────────
const handleValidate = (field: "name" | "email") => async (req: any, res: any) => {
  try {
    const value = req.body[field];
    if (!value) return res.status(400).json({ status: "error", message: `Please enter a ${field}.` });

    await AuthService.validateField(field, value);
    return res.status(200).json({ status: "success", message: `This ${field} is available.` });

  } catch (err: any) {
    if (err.status) return res.status(err.status).json({ status: "info", message: err.message });
    return res.status(500).json({ status: "error", message: "Something went wrong." });
  }
};

export const uploadGovernmentIdAndBecomeGuide = async (req: any, res: any) => {
  let uploadedPublicId: string | null = null;

  try {
    // 1. Validate file exists
    if (!req.file)
      return res.status(400).json({ success: false, message: "No file uploaded" });

    // 2. Validate file type
    const allowed = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
    if (!allowed.includes(req.file.mimetype))
      return res.status(400).json({ success: false, message: "Only JPG, PNG, or PDF files are allowed" });

    const userId = req.body.userId;

    // 3. Call service
    const { uploadResult, updatedGuide, updatedUser } =
      await AuthService.uploadGovernmentId(req.file, userId);

    uploadedPublicId = uploadResult.public_id;

    return res.status(200).json({
      success: true,
      message: "Government ID uploaded and guide role activated",
      data: {
        guide: updatedGuide,
        user: { _id: updatedUser._id, name: updatedUser.name, role: updatedUser.role },
        document: { url: uploadResult.secure_url, uploadedAt: new Date() },
      },
    });

  } catch (err: any) {
    // Cleanup if upload succeeded but DB failed
    if (uploadedPublicId) {
      await AuthService.cleanupCloudinaryUpload(uploadedPublicId);
    }

    if (err.status === 503) return res.status(503).json({ success: false, message: err.message });
    if (err.status === 502) return res.status(502).json({ success: false, message: err.message });
    if (err.message?.includes("timeout"))
      return res.status(504).json({ success: false, message: "Operation timed out. Try a smaller file." });

    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const validateName = handleValidate("name");
export const validateEmail = handleValidate("email");