// config/authRouteConfig.ts
import { upload } from "../../config/uploadConfig";
import { RouteConfig } from "../../types/routeConfig";
import { authRateLimit } from "../../middleware/rateLimit.js";
import {
  signup, signupGuide,
  login, Guidelogin,
  verifyEmail, verifyGuideEmail,
  resendVerificationEmail,
  forgotPassword, verifyResetCode, resetPassword,
  validateName, validateEmail,
  uploadGovernmentIdAndBecomeGuide,
} from "../../controllers/auth/authController.js";

export const authRoutes: RouteConfig[] = [
  // ── User Auth ──────────────────────────────────────
  { method: "post", path: "/signup", handler: signup },
  { method: "post", path: "/login", middlewares: [authRateLimit("login", 10, 60)], handler: login },
  { method: "post", path: "/resendverification", middlewares: [authRateLimit("resend-verify", 5, 60)], handler: resendVerificationEmail },
  { method: "get", path: "/verify-email/:token", handler: verifyEmail },

  // ── Guide Auth ─────────────────────────────────────
  { method: "post", path: "/guide/signup", handler: signupGuide },
  { method: "post", path: "/guide/login", middlewares: [authRateLimit("guide-login", 10, 60)], handler: Guidelogin },
  { method: "get", path: "/guide/verify-email/:token", handler: verifyGuideEmail },

  // ── Password ───────────────────────────────────────
  { method: "post", path: "/forgot-password", middlewares: [authRateLimit("forgot-password", 5, 60)], handler: forgotPassword },
  { method: "post", path: "/verify-reset-code", middlewares: [authRateLimit("verify-reset-code", 10, 60)], handler: verifyResetCode },
  { method: "post", path: "/reset-password", middlewares: [authRateLimit("reset-password", 10, 60)], handler: resetPassword },

  // ── Validation ─────────────────────────────────────
  { method: "post", path: "/validate/name", handler: validateName },
  { method: "post", path: "/validate/email", handler: validateEmail },

  // ── File Upload ────────────────────────────────────
  {
    method: "post",
    path: "/verifyId",
    middlewares: [upload.single("governmentId")],
    handler: uploadGovernmentIdAndBecomeGuide,
  },
];