import mongoose from "mongoose";
import UserProfile from "../../models/UserProfile.js";
import { Country, State } from "../../models/predefineSchemas.js";
import cloudinary from "cloudinary";
import sharp from "sharp";

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000; // 1 second initial delay

// Utility function with retry mechanism
const withRetry = async (fn, args, operationName, retries = MAX_RETRIES, delay = INITIAL_DELAY_MS) => {
  try {
    return await fn(...args);
  } catch (error) {
    if (retries <= 0) {
      console.error(`Final attempt failed for ${operationName}:`, error);
      throw error;
    }
    
    console.warn(`Attempt ${MAX_RETRIES - retries + 1} failed for ${operationName}. Retrying in ${delay}ms...`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return withRetry(fn, args, operationName, retries - 1, delay * 2); // Exponential backoff
  }
};

const optimizeImage = async (buffer) => {
  return await withRetry(
    async () => {
      return await sharp(buffer).resize({ width: 800 }).toBuffer();
    },
    [],
    "image optimization"
  );
};

// Enhanced Cloudinary upload with retry
const uploadToCloudinary = async (fileBuffer) => {
  return withRetry(
    () => new Promise((resolve, reject) => {
      cloudinary.v2.uploader.upload_stream(
        { resource_type: "image", timeout: 60000 },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      ).end(fileBuffer);
    }),
    [],
    "Cloudinary upload"
  );
};

// Enhanced Cloudinary delete with retry
const deleteFromCloudinary = (publicId) => {
  return withRetry(
    () => new Promise((resolve, reject) => {
      cloudinary.v2.uploader.destroy(publicId, (error, result) => {
        if (error) reject(new Error(`Cloudinary delete failed: ${error.message}`));
        else resolve(result);
      });
    }),
    [publicId],
    "Cloudinary delete"
  );
};

// Enhanced database operations with retry
// Updated databaseOperation helper
const databaseOperation = async (operation, ...args) => {
  return withRetry(
    async () => {
      const result = await operation(...args);
      return result;
    },
    [],
    `Database operation`
  );
};


export const getProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID format" });
    }

    // Updated query execution
    const profile = await databaseOperation(
      () => UserProfile.findOne({ userId }).lean()
    );

    if (!profile) {
      return res.status(404).json({ message: "Profile not found. Please create a profile." });
    }

    const [country, state] = await Promise.all([
      profile.address?.countryId 
        ? databaseOperation(() => Country.findById(profile.address.countryId).lean())
        : null,
      profile.address?.stateId 
        ? databaseOperation(() => State.findById(profile.address.stateId).lean())
        : null
    ]);

    (`Profile fetched for ${userId}`);

    res.status(200).json({
      ...profile,
      profilePicture: profile.profilePicture || "https://picsum.photos/300/300?grayscale",
      address: {
        ...profile.address,
        countryName: country ? country.countryName : null,
        stateName: state ? state.stateName : null,
      },
    });
  } catch (error) {
    console.error("Error fetching profile:", error.message);
    res.status(500).json({ message: "Error fetching profile", error: error.message });
  }
};
// ✅ Create a New User Profile
export const createProfile = async (req, res) => {
  let cloudinaryPublicId = null;
  
  try {
    const { userId, firstName, lastName, gender, phoneNumber, dateOfBirth, countryName, stateName } = req.body;

    // Basic validations
    if (!userId || !firstName || !lastName || !gender) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!["male", "female", "others"].includes(gender.toLowerCase())) {
      return res.status(400).json({ error: "Invalid gender value" });
    }

    // Handle profile picture upload to Cloudinary
    let profilePicUrl = "https://picsum.photos/300/300?grayscale"; // Default fallback

    if (req.file) {
      try {
        // Validate file type
        if (!req.file.mimetype.startsWith('image/')) {
          return res.status(400).json({
            error: "Invalid file type",
            message: "Only image files are allowed for profile pictures"
          });
        }

        // Optimize and upload image
        const optimizedBuffer = await optimizeImage(req.file.buffer);
        const uploadResult = await uploadToCloudinary(optimizedBuffer);
        profilePicUrl = uploadResult.secure_url;
        cloudinaryPublicId = uploadResult.public_id;

        (`Uploaded profile picture to Cloudinary: ${profilePicUrl}`);
      } catch (uploadError) {
        console.error("Cloudinary upload failed:", uploadError);
        return res.status(500).json({
          error: "Profile picture upload failed",
          message: "Could not upload profile picture. Please try again."
        });
      }
    }

    // Look up country and state
    const [country, state] = await Promise.all([
      countryName ? databaseOperation(Country.findOne.bind(Country), { 
        countryName: new RegExp(`^${countryName.trim()}$`, "i") 
      }) : null,
      stateName ? databaseOperation(State.findOne.bind(State), { 
        stateName: new RegExp(`^${stateName.trim()}$`, "i") 
      }) : null
    ]);

    if (countryName && !country) {
      return res.status(400).json({ error: "Invalid country name" });
    }

    // Create and save profile
    const newProfile = new UserProfile({
      userId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      gender: gender.toLowerCase(),
      phoneNumber: phoneNumber?.trim(),
      dateOfBirth,
      profilePicture: profilePicUrl,
      cloudinaryPublicId,
      address: {
        countryId: country?._id || null,
        stateId: state?._id || null,
        countryName: country ? country.countryName : null,
        stateName: state?.stateName || null
      }
    });

    const savedProfile = await databaseOperation(newProfile.save.bind(newProfile));

    res.status(201).json({
      success: true,
      message: "Profile created successfully",
      profile: {
        ...savedProfile.toObject(),
        cloudinaryPublicId: undefined
      }
    });

  } catch (error) {
    console.error("Error creating profile:", error);
    
    // Clean up Cloudinary image if upload succeeded but save failed
    if (cloudinaryPublicId) {
      try {
        await deleteFromCloudinary(cloudinaryPublicId);
        (`Cleaned up orphaned Cloudinary image: ${cloudinaryPublicId}`);
      } catch (cleanupError) {
        console.error("Failed to clean up Cloudinary image:", cleanupError);
      }
    }

    res.status(500).json({
      error: "Internal Server Error",
      message: "An unexpected error occurred while creating your profile",
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
};

// ✅ Update User Profile (Users Only)
export const updateProfile = async (req, res) => {
  let newCloudinaryPublicId = null;
  
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID format." });
    }

    const { firstName, lastName, gender, phoneNumber, dateOfBirth, countryName, stateName } = req.body;

    if (gender && !["male", "female", "others"].includes(gender)) {
      return res.status(400).json({ error: "Invalid gender value." });
    }

    // Fixed database operation
    const existingProfile = await databaseOperation(() => 
      UserProfile.findOne({ userId })
    );
    
    if (!existingProfile) {
      return res.status(404).json({ error: "Profile not found." });
    }

    // Look up country and state if provided
    const [country, state] = await Promise.all([
      countryName ? databaseOperation(() => 
        Country.findOne({ countryName: new RegExp(`^${countryName.trim()}$`, "i") })
      ) : null,
      stateName ? databaseOperation(() => 
        State.findOne({ stateName: new RegExp(`^${stateName.trim()}$`, "i") })
      ) : null
    ]);

    if (countryName && !country) {
      return res.status(400).json({ error: "Invalid country name." });
    }
    if (stateName && !state) {
      return res.status(400).json({ error: "Invalid state name." });
    }

    let profilePicUrl = existingProfile.profilePicture;
    let oldCloudinaryPublicId = existingProfile.cloudinaryPublicId;

    // Handle new profile picture upload
    if (req.file) {
      try {
        (`Processing new profile picture for ${userId}`);
        
        const optimizedBuffer = await optimizeImage(req.file.buffer);
        const uploadResult = await uploadToCloudinary(optimizedBuffer);
        profilePicUrl = uploadResult.secure_url;
        newCloudinaryPublicId = uploadResult.public_id;

        (`New profile picture uploaded for ${userId}: ${profilePicUrl}`);
      } catch (uploadError) {
        console.error("Cloudinary upload failed:", uploadError);
        return res.status(500).json({
          error: "Profile picture upload failed",
          message: "Could not upload new profile picture. Please try again."
        });
      }
    }

    // Fixed update operation
    const updatedProfile = await databaseOperation(() => 
      UserProfile.findOneAndUpdate(
        { userId },
        {
          firstName: firstName || existingProfile.firstName,
          lastName: lastName || existingProfile.lastName,
          gender: gender || existingProfile.gender,
          phoneNumber: phoneNumber || existingProfile.phoneNumber,
          dateOfBirth: dateOfBirth || existingProfile.dateOfBirth,
          profilePicture: profilePicUrl,
          cloudinaryPublicId: newCloudinaryPublicId || oldCloudinaryPublicId,
          address: {
            countryId: country ? country._id : existingProfile.address?.countryId,
            stateId: state ? state._id : existingProfile.address?.stateId,
            countryName: country ? country.countryName : existingProfile.address?.countryName,
            stateName: state ? state.stateName : existingProfile.address?.stateName
          },
        },
        { new: true, runValidators: true }
      ).lean() // Now properly chained
    );

    // Delete old image if it was replaced
    if (newCloudinaryPublicId && oldCloudinaryPublicId && !existingProfile.profilePicture.includes("picsum.photos")) {
      try {
        await deleteFromCloudinary(oldCloudinaryPublicId);
        (`Old profile picture deleted from Cloudinary: ${oldCloudinaryPublicId}`);
      } catch (deleteError) {
        console.error("Failed to delete old Cloudinary image:", deleteError);
      }
    }

    res.status(200).json({
      ...updatedProfile,
      cloudinaryPublicId: undefined,
      profilePicture: updatedProfile.profilePicture || "https://picsum.photos/300/300?grayscale"
    });

  } catch (error) {
    console.error("Error updating profile:", error);
    
    if (newCloudinaryPublicId) {
      try {
        await deleteFromCloudinary(newCloudinaryPublicId);
        (`Cleaned up orphaned Cloudinary image: ${newCloudinaryPublicId}`);
      } catch (cleanupError) {
        console.error("Failed to clean up new Cloudinary image:", cleanupError);
      }
    }

    res.status(500).json({
      error: "Internal Server Error",
      message: "An unexpected error occurred while updating your profile",
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
};

// ✅ Delete User Profile (Users Only)
export const deleteProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID format" });
    }

    const profile = await databaseOperation(UserProfile.findOne.bind(UserProfile), { userId });
    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    // Delete profile picture from Cloudinary if it exists and isn't the default
    if (profile.cloudinaryPublicId && !profile.profilePicture.includes("picsum.photos")) {
      try {
        await deleteFromCloudinary(profile.cloudinaryPublicId);
        (`Profile picture deleted from Cloudinary for ${userId}: ${profile.cloudinaryPublicId}`);
      } catch (deleteError) {
        console.error("Failed to delete Cloudinary image:", deleteError);
        // Continue with profile deletion even if image deletion fails
      }
    }

    await databaseOperation(UserProfile.findOneAndDelete.bind(UserProfile), { userId });
    (`Profile deleted for ${userId}`);

    res.status(200).json({ message: "Profile deleted successfully" });
  } catch (error) {
    console.error("Error deleting profile:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};