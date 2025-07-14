import express from "express";
import {
  getAllGuides,
  getGuideProfile,
  updateGuideProfile,
  createProfile,
} from "../../controllers/guide/profilecontroller.js";
import multer from "multer";

// Configure multer
const storage = multer.memoryStorage();
const upload = multer({ storage });

const router = express.Router();

// ✅ Fetch all guides (no file upload needed)
router.get("/", getAllGuides);

// ✅ Create a guide profile (with file uploads)
router.post(
  "/",
  upload.fields([
    { name: "profilePic", maxCount: 1 },
    { name: "aadharFile", maxCount: 1 },
  ]),
  createProfile
);

// ✅ Get a specific guide profile (no file upload needed)
router.get("/:userId", getGuideProfile);

// ✅ Update a specific guide profile (with file uploads)
router.put(
  "/:userId",
  upload.fields([
    { name: "profilePic", maxCount: 1 },
    { name: "aadharCardPhoto", maxCount: 1 },
  ]),
  updateGuideProfile
);

export default router;