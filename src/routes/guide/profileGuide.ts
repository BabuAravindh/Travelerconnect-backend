import express from "express";
import {
  getAllGuides,
  getGuideProfile,
  updateGuideProfile,
  createProfile,
} from "../../controllers/guide/profilecontroller.js";
import multer from "multer";
import authenticateUser, { optionalAuth } from "../../middleware/authMiddleware.js";

// Configure multer
const storage = multer.memoryStorage();
const upload = multer({ storage });

const router = express.Router();

// ✅ Fetch all guides (public listing)
router.get("/", getAllGuides);

// ✅ Create a guide profile (with file uploads)
router.post(
  "/",
  authenticateUser,
  upload.fields([
    { name: "profilePic", maxCount: 1 },
    { name: "aadharFile", maxCount: 1 },
  ]),
  createProfile
);

// ✅ Get a specific guide profile (public, but bank details only shown to owner/admin)
router.get("/:userId", optionalAuth, getGuideProfile);

// ✅ Update a specific guide profile (with file uploads)
router.put(
  "/:userId",
  authenticateUser,
  upload.fields([
    { name: "profilePic", maxCount: 1 },
    { name: "aadharCardPhoto", maxCount: 1 },
  ]),
  updateGuideProfile
);

export default router;