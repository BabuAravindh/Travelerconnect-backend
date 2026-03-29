import User from "../../models/User.js";
import UserProfile from "../../models/UserProfile.js";
import Guide from "../../models/Guide.js";
import { Language } from "../../models/predefineSchemas.js";
import Activity from "../../models/activityModel.js";

// Get all users
export const getUsers = async (req, res) => {
  try {
    const users = await User.find({}, "name email role");
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Get single user
export const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id, "name email role");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Update user
export const updateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      select: "name email role",
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Delete user
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Get full user details (with profile and guide info if applicable)
export const getUserFullDetails = async (req, res) => {
  try {
    const { id } = req.params;

    // Base user info
    const user = await User.findById(id)
      .select("-password -resetPasswordToken -resetPasswordExpire")
      .lean();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Fetch profile and guide info in parallel
    const [userProfile, guideDetails] = await Promise.all([
      UserProfile.findOne({ userId: id }).lean(),
      user.role === "guide"
        ? Guide.findOne({ userId: id })
            .populate("languages", "name code")
            .populate("activities", "name category")
            .lean()
        : null,
    ]);

    // Construct base response
    const response = {
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      profile: userProfile
        ? {
            bio: userProfile.bio,
            phone: userProfile.phone,
            profilePicture: userProfile.profilePicture,
            // add more fields if needed
          }
        : null,
      guideDetails: null,
    };

    // Add guide details if guide
    if (user.role === "guide" && guideDetails) {
      response.guideDetails = {
        bio: guideDetails.bio,
        languages: guideDetails.languages || [],
        activities: guideDetails.activities || [],
        serviceLocations: guideDetails.serviceLocations || [],
        status: guideDetails.status,
        verification: {
          aadharCardPhoto: guideDetails.aadharCardPhoto,
          bankAccountNumber: guideDetails.bankAccountNumber
            ? `••••${guideDetails.bankAccountNumber.slice(-4)}`
            : null,
          submittedAt: guideDetails.submittedAt,
          reviewedAt: guideDetails.reviewedAt,
        },
        professionalDetails: {
          experience: guideDetails.experience,
          pricing: guideDetails.pricing,
          availability: guideDetails.availability,
        },
      };
    }

    res.json(response);
  } catch (error) {
    console.error("Error in getUserFullDetails:", error);
    res.status(500).json({
      error: "Server error",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
