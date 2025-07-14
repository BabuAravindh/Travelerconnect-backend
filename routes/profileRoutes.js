import express from "express";
import {
  getProfile,
  createProfile,
  updateProfile,
  deleteProfile,
} from "../controllers/user/profileController.js";
import multer from "multer";
import User from "../models/User.js";
import deleteUser from "../services/deleteUser.js"; // Import the function
const storage = multer.memoryStorage();
const upload = multer({ storage });
import Guide from "../models/Guide.js";
import Booking from "../models/BookingModel.js"; // Import the Booking model

const router = express.Router();

router.get("/users", async (req, res) => {
  try {
    const users = await User.aggregate([
      {
        $match: { role: { $in: ["user", "guide", "admin"] } }
      },
      {
        $lookup: {
          from: "userprofiles",
          localField: "_id",
          foreignField: "userId",
          as: "profile"
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          role: 1,
          firstName: { $arrayElemAt: ["$profile.firstName", 0] },
          lastName: { $arrayElemAt: ["$profile.lastName", 0] },
          dateOfBirth: { $arrayElemAt: ["$profile.dateOfBirth", 0] },
          phoneNumber: { $arrayElemAt: ["$profile.phoneNumber", 0] }
        }
      }
    ]);

    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: error.message });
  }
});


router.get("/guides", async (req, res) => {
  try {
    const guides = await User.aggregate([
      {
        $match: { role: "guide" }
      },
      {
        $lookup: {
          from: "userprofiles",
          localField: "_id",
          foreignField: "userId",
          as: "profile"
        }
      },
      {
        $lookup: {
          from: "guides",
          localField: "_id",
          foreignField: "userId",
          as: "guideInfo"
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          role: 1,
          phoneNumber: {
            $arrayElemAt: ["$profile.phoneNumber", 0]
          },
          firstName: {
            $arrayElemAt: ["$profile.firstName", 0]  // Fetching firstName from the userprofile schema
          },
          lastName: {
            $arrayElemAt: ["$profile.lastName", 0]  // Fetching lastName from the userprofile schema
          },
          profilePicture: {
            $arrayElemAt: ["$profile.profilePicture", 0]  // Fetching profilePicture from the userprofile schema
          },
          bankAccountNumber: {
            $arrayElemAt: ["$guideInfo.bankAccountNumber", 0]
          },
          ifscCode: {
            $arrayElemAt: ["$guideInfo.ifscCode", 0]
          },
          bankName: {
            $arrayElemAt: ["$guideInfo.bankName", 0]
          },
          verificationStatus: {
            $arrayElemAt: ["$guideInfo.verificationStatus", 0]
          },
          active: {
            $arrayElemAt: ["$guideInfo.active", 0]  // Fetching the active boolean
          },
          profileName: {
            $arrayElemAt: ["$profile.firstName", 0]  // Fetching the name from the userprofile schema
          }
        }
      }
    ]);

    res.status(200).json(guides);
  } catch (error) {
    console.error("Error fetching guides:", error);
    res.status(500).json({ message: error.message });
  }
});

router.put("/guides/:userId/toggleStatus", async (req, res) => {
  try {
    // Find the guide by userId
    const guide = await Guide.findOne({ userId: req.params.userId });

    if (!guide) {
      return res.status(404).json({
        success: false,
        message: "Guide not found",
      });
    }

    // Check if there are any active bookings for the guide
    const bookings = await Booking.find({ guideId: guide.userId, status: { $ne: 'cancelled' } });

    if (bookings.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot deactivate guide with active bookings",
      });
    }

    // If no active bookings, toggle the active status
    guide.active = !guide.active;

    // Save the updated guide status without validation
    await guide.updateOne({ $set: { active: guide.active } });

    res.status(200).json({
      success: true,
      message: guide.active ? "Guide is now active" : "Guide is now inactive",
    });
  } catch (error) {
    console.error("Error toggling guide status:", error);
    res.status(500).json({
      success: false,
      message: "Error toggling guide status",
    });
  }
});



router.delete("/:userId", async (req, res) => {
  const { userId } = req.params;
  const result = await deleteUser(userId);
   console.log('user deleted succssfully',result)
  if (result.success) {
    res.status(200).json(result);
  } else {
    res.status(500).json(result);
  }
});

// ✅ Fetch user profile (no file upload needed)
router.get("/:userId", getProfile);

// ✅ Create a user profile (with file upload)
router.post(
  "/",
  upload.single("profilePic"), // This handles single file upload with field name "profilePic"
  createProfile
);


// ✅ Update a user profile (with file upload)
router.put(
  "/:userId",
  upload.single("profilePic"),
  updateProfile
);

export default router;