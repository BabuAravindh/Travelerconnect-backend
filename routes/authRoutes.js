import express from "express";
import multer from "multer"; // Add multer import
import { 
  signup, 
  login,  
  forgotPassword, 
  verifyResetCode, 
  resetPassword, 
  verifyEmail, 
  resendVerificationEmail,
  signupGuide,
  verifyGuideEmail,
  uploadGovernmentIdAndBecomeGuide,
  Guidelogin,
  validateName,
  validateEmail
} from "../controllers/authController.js";
import Guide from "../models/Guide.js";

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(), // Store files in memory (or use diskStorage if preferred)
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit, matching your frontend validation
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Only JPG, PNG, or PDF files are allowed"));
      
    }
    cb(null, true);
  },
});


router.post("/signup", signup);
router.post("/login", login);
router.post("/guide/signup", signupGuide);
router.post("/guide/login", Guidelogin);  
router.post("/resendverification", resendVerificationEmail);
router.get("/verify-email/:token", verifyEmail);
// Use multer middleware for file upload
router.post("/verifyId", upload.single("governmentId"), uploadGovernmentIdAndBecomeGuide);
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-code", verifyResetCode);
router.post("/reset-password", resetPassword);

export default router;