import User from "../../models/User.js";
import Guide from "../../models/Guide.js";
import UserProfile from "../../models/UserProfile.js";
import { City, Language, Country, State } from "../../models/predefineSchemas.js";
import Activity from "../../models/activityModel.js";
import cloudinary from "cloudinary";
import sharp from "sharp";
import mongoose from "mongoose";
import { fetch } from 'undici';
import { Agent as HttpAgent } from "http";
import { Agent as HttpsAgent } from "https";

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  timeout: 180000,
  httpAgent: new HttpAgent({ timeout: 180000 }),
  httpsAgent: new HttpsAgent({ timeout: 180000 }),
});

// Network stability check
const checkNetwork = async () => {
  try {
    const response = await fetch("https://www.google.com", { method: "HEAD", timeout: 2000 });
    return response.ok;
  } catch (err) {
    throw new Error(`Network check failed: ${err.message}`);
  }
};

// Cloudinary service status check
const checkCloudinaryStatus = async () => {
  try {
    const response = await fetch("https://status.cloudinary.com/api/v2/status.json");
    const { status } = await response.json();
    if (status.indicator !== "none") {
      throw new Error(`Cloudinary service issue: ${status.description}`);
    }
    return true;
  } catch (err) {
    throw new Error(`Failed to check Cloudinary status: ${err.message}`);
  }
};

// Utility function to upload to Cloudinary with detailed diagnostics
const uploadToCloudinaryWithDebug = (fileBuffer, folder) => {
  return new Promise((resolve, reject) => {
    console.log(`Initiating upload to ${folder}, Buffer size: ${(fileBuffer.length / 1024).toFixed(2)} KB`);
    const startTime = Date.now();

    const timeoutId = setTimeout(() => {
      reject(new Error("Upload timed out locally after 20s"));
    }, 20000);

    const uploadStream = cloudinary.v2.uploader.upload_stream(
      { folder, timeout: 180000 },
      (error, result) => {
        clearTimeout(timeoutId);
        const elapsedTime = (Date.now() - startTime) / 1000;
        if (error) {
          console.error(`Upload failed after ${elapsedTime}s:`, {
            message: error.message,
            http_code: error.http_code || "N/A",
            name: error.name,
            stack: error.stack,
          });
          reject(error);
        } else {
          if (!result?.secure_url || !result?.public_id) {
            console.error(`Invalid Cloudinary response:`, result);
            reject(new Error("Invalid Cloudinary response: missing secure_url or public_id"));
          } else {
            console.log(`Upload succeeded after ${elapsedTime}s:`, result.secure_url);
            resolve(result);
          }
        }
      }
    );

    uploadStream.on("error", (err) => {
      clearTimeout(timeoutId);
      console.error("Upload stream error:", {
        message: err.message,
        stack: err.stack,
      });
      reject(err);
    });

    try {
      uploadStream.end(fileBuffer);
    } catch (err) {
      clearTimeout(timeoutId);
      console.error("Error ending upload stream:", {
        message: err.message,
        stack: err.stack,
      });
      reject(err);
    }
  });
};

// Retry logic
const uploadWithRetry = async (fileBuffer, folder, retries = 5) => {
  try {
    await checkCloudinaryStatus();
    await checkNetwork();
    for (let attempt = 1; attempt <= retries; attempt++) {
      console.log(`Attempt ${attempt} of ${retries}`);
      try {
        const result = await uploadToCloudinaryWithDebug(fileBuffer, folder);
        console.log("Upload completed successfully:", result.secure_url);
        return result;
      } catch (error) {
        console.warn(`Upload attempt ${attempt} failed for ${folder}:`, {
          message: error.message,
          http_code: error.http_code || "N/A",
        });
        if (attempt === retries) throw error;
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
      }
    }
  } catch (error) {
    console.error("All upload attempts failed");
    throw error;
  }
};

// ✅ Get Guide Profile
export const getGuideProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "Invalid or missing userId." });
    }

    const [user, userProfile, guideProfile] = await Promise.all([
      User.findById(userId).lean(),
      UserProfile.findOne({ userId })
        .populate("address.stateId", "stateName")
        .populate("address.countryId", "countryName")
        .lean(),
      Guide.findOne({ userId })
        .populate("activities", "activityName")
        .populate("languages", "languageName")
        .populate("serviceLocations", "cityName")
        .lean(),
    ]);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (!userProfile) {
      return res.status(404).json({ message: "User profile not found." });
    }

    const defaultProfilePic = "https://picsum.photos/300/300?grayscale";
    let response = {
      firstName: userProfile.firstName || "",
      lastName: userProfile.lastName || "",
      email: user.email || "",
      role: user.role || "guide",
      profilePicture:
        userProfile.profilePicture && userProfile.profilePicture !== ""
          ? userProfile.profilePicture
          : user.profilePicture && user.profilePicture !== ""
          ? user.profilePicture
          : defaultProfilePic,
      isVerified: user.isVerified ?? false,
      phoneNumber: userProfile.phoneNumber || "",
      gender: userProfile.gender || "",
      dateJoined: userProfile.dateJoined || new Date().toISOString(),
      state: userProfile.address?.stateId?.stateName || "",
      country: userProfile.address?.countryId?.countryName || "",
    };

    if (user.role === "guide") {
      if (!guideProfile) {
        return res.status(404).json({ message: "Guide profile not found." });
      }

      response = {
        ...response,
        bio: guideProfile.bio || "",
        bankAccountNumber: guideProfile.bankAccountNumber || "",
        ifscCode: guideProfile.ifscCode || "",
        bankName: guideProfile.bankName || "",
        profilePicture:
          guideProfile.profilePic?.secure_url && guideProfile.profilePic.secure_url !== ""
            ? guideProfile.profilePic.secure_url
            : response.profilePicture,
        activities: guideProfile.activities?.map((activity) => activity.activityName) || [],
        languages: guideProfile.languages?.map((language) => language.languageName) || [],
        serviceLocations: guideProfile.serviceLocations?.map((city) => city.cityName) || [],
      };

      // Validate Cloudinary URL for profilePicture
      const cloudinaryUrlPattern = /^https:\/\/res\.cloudinary\.com\/.*$/;
      if (response.profilePicture && !cloudinaryUrlPattern.test(response.profilePicture)) {
        console.warn(`Profile picture URL for user ${userId} is not a valid Cloudinary URL: ${response.profilePicture}`);
        response.profilePicture = defaultProfilePic;
      }
    }

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching guide profile:", error.message || error);
    res.status(500).json({
      message: "Server error. Please try again.",
      error: error.message || "Unknown error",
    });
  }
};

// ✅ Update Guide Profile
export const updateGuideProfile = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId } = req.params;
    const {
      newUserId,
      firstName,
      lastName,
      email,
      phoneNumber,
      gender,
      dateJoined,
      state,
      country,
      bio,
      activities = [],
      languages = [],
      bankAccountNumber,
      ifscCode,
      bankName,
      serviceLocations = [],
    } = req.body;

    console.log(`Starting profile update for user: ${userId}`);
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    // Validate user exists
    const existingUser = await User.findById(userId).session(session);
    if (!existingUser) {
      await session.abortTransaction();
      return res.status(404).json({ message: "User not found." });
    }

    // If newUserId is provided and different from current userId
    if (newUserId && newUserId !== userId) {
      const userWithNewId = await User.findById(newUserId).session(session);
      if (userWithNewId) {
        await session.abortTransaction();
        return res.status(400).json({ message: "New user ID already exists." });
      }

      existingUser._id = newUserId;
      await existingUser.save({ session });

      await Promise.all([
        UserProfile.updateOne({ userId }, { userId: newUserId }).session(session),
        Guide.updateOne({ userId }, { userId: newUserId }).session(session),
      ]);

      userId = newUserId;
    }

    // Process profile picture upload with retries
    let profilePicData = null;

    if (req.files?.["profilePic"]?.[0]) {
      const file = req.files["profilePic"][0];
      console.log(`Processing profile picture (${file.originalname}, ${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      profilePicData = await uploadWithRetry(file.buffer, "guide_profiles");
      console.log("Profile picture uploaded:", profilePicData.secure_url);
    }

    // Validate references
    const validationPromises = [];

    if (state) {
      validationPromises.push(
        State.findOne({ stateName: state })
          .session(session)
          .then((stateDoc) => {
            if (!stateDoc) throw new Error(`State '${state}' not found`);
            return stateDoc;
          })
      );
    }

    if (country) {
      validationPromises.push(
        Country.findOne({ countryName: country })
          .session(session)
          .then((countryDoc) => {
            if (!countryDoc) throw new Error(`Country '${country}' not found`);
            return countryDoc;
          })
      );
    }

    if (activities.length > 0) {
      validationPromises.push(
        Activity.find({ activityName: { $in: activities } })
          .session(session)
          .then((activityDocs) => {
            if (activityDocs.length !== activities.length) {
              throw new Error("One or more activities not found");
            }
            return activityDocs;
          })
      );
    }

    if (languages.length > 0) {
      validationPromises.push(
        Language.find({ languageName: { $in: languages } })
          .session(session)
          .then((languageDocs) => {
            if (languageDocs.length !== languages.length) {
              throw new Error("One or more languages not found");
            }
            return languageDocs;
          })
      );
    }

    if (serviceLocations.length > 0) {
      validationPromises.push(
        City.find({ cityName: { $in: serviceLocations } })
          .session(session)
          .then((cityDocs) => {
            if (cityDocs.length !== serviceLocations.length) {
              throw new Error("One or more service locations not found");
            }
            return cityDocs;
          })
      );
    }

    const [stateDoc, countryDoc, activityDocs, languageDocs, cityDocs] = await Promise.all(validationPromises);

    // Update user profile
    const userProfile = await UserProfile.findOneAndUpdate(
      { userId },
      {
        firstName,
        lastName,
        email: email || existingUser.email,
        phoneNumber,
        gender,
        profilePicture: profilePicData?.secure_url || undefined, // Avoid setting empty string
        dateJoined: dateJoined ? new Date(dateJoined) : new Date(),
        address: {
          ...(stateDoc && { stateId: stateDoc._id }),
          ...(countryDoc && { countryId: countryDoc._id }),
        },
      },
      { new: true, upsert: true, session }
    );

    // Update guide profile
    const guideProfile = await Guide.findOneAndUpdate(
      { userId },
      {
        bio,
        bankAccountNumber: bankAccountNumber || undefined,
        ifscCode: ifscCode || undefined,
        bankName: bankName || undefined,
        profilePic: profilePicData
          ? {
              public_id: profilePicData.public_id,
              url: profilePicData.url,
              secure_url: profilePicData.secure_url,
              uploadedAt: new Date(),
            }
          : undefined,
        activities: activityDocs?.map((activity) => activity._id),
        languages: languageDocs?.map((language) => language._id),
        serviceLocations: cityDocs?.map((city) => city._id),
      },
      { new: true, upsert: true, session }
    );

    await session.commitTransaction();
    console.log(`Successfully updated profile for user: ${userId}`);

    res.status(200).json({
      message: "Guide profile updated successfully.",
      data: {
        userProfile: userProfile.toObject(),
        guideProfile: guideProfile.toObject(),
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error updating guide profile:", {
      message: error.message,
      stack: error.stack,
      userId: req.params.userId,
    });

    if (error.message.includes("not found")) {
      return res.status(400).json({ message: error.message });
    }

    if (error.message.includes("validation failed")) {
      return res.status(400).json({
        message: "Validation failed",
        errors: error.errors,
      });
    }

    res.status(500).json({
      message: "Failed to update guide profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    session.endSession();
  }
};

// ✅ Create Guide Profile
export const createProfile = async (req, res) => {
  try {
    const { userId, activities, bankAccountNumber, ifscCode, bankName, bio, languages, serviceLocations } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const userProfile = await UserProfile.findOne({ userId });
    if (!userProfile) {
      return res.status(400).json({ message: "User profile does not exist. Please create a user profile first." });
    }

    const existingGuide = await Guide.findOne({ userId });
    if (existingGuide) {
      return res.status(400).json({ message: "Guide profile already exists." });
    }

    let profilePicData = null;

    if (req.files?.["profilePic"]?.[0]) {
      console.log(`Profile picture received for ${userId}: ${req.files["profilePic"][0].originalname}`);
      profilePicData = await uploadWithRetry(req.files["profilePic"][0].buffer, "guide_profiles");
      console.log(`Profile picture uploaded for ${userId}: ${profilePicData.secure_url}`);
    }

    const [languageDocs, activityDocs, cityDocs] = await Promise.all([
      Language.find({ languageName: { $in: languages } }),
      Activity.find({ activityName: { $in: activities } }),
      City.find({ cityName: { $in: serviceLocations } }),
    ]);

    const languageIds = languageDocs.map((lang) => lang._id);
    const activityIds = activityDocs.map((act) => act._id);
    const cityIds = cityDocs.map((city) => city._id);

    if (languageIds.length !== languages.length) {
      return res.status(400).json({ message: "Some languages were not found." });
    }
    if (activityIds.length !== activities.length) {
      return res.status(400).json({ message: "Some activities were not found." });
    }
    if (cityIds.length !== serviceLocations.length) {
      return res.status(400).json({ message: "Some service locations (cities) were not found." });
    }

    const newGuideProfile = new Guide({
      userId,
      profilePic: profilePicData
        ? {
            public_id: profilePicData.public_id,
            url: profilePicData.url,
            secure_url: profilePicData.secure_url,
            uploadedAt: new Date(),
          }
        : undefined,
      activities: activityIds,
      bankAccountNumber,
      ifscCode,
      bankName,
      bio,
      languages: languageIds,
      serviceLocations: cityIds,
    });

    await newGuideProfile.save();

    // Update UserProfile with profilePicture if provided
    userProfile.profilePicture = profilePicData?.secure_url || userProfile.profilePicture || undefined;
    await userProfile.save();

    user.role = "guide";
    await user.save();

    res.status(201).json({
      message: "Guide profile created successfully!",
      profile: newGuideProfile,
    });
  } catch (error) {
    console.error("Error creating guide profile:", error);
    res.status(500).json({ message: "Server error. Please try again." });
  }
};// ✅ Get All Guides with Complete Data
export const getAllGuides = async (req, res) => {
  try {
    const { state, language, activity, gender, city, active } = req.query; // Include 'active' in query parameters

    const users = await User.find({ role: "guide" }, "-password").lean();

    const guides = await Promise.all(
      users.map(async (user) => {
        const [userProfile, guideDetails] = await Promise.all([
          UserProfile.findOne({ userId: user._id })
            .populate("address.stateId", "stateName")
            .lean(),
          Guide.findOne({ userId: user._id })
            .populate("languages", "languageName")
            .populate("activities", "activityName")
            .populate("serviceLocations", "cityName")
            .lean(),
        ]);

        const defaultProfilePic = "https://picsum.photos/300/300?grayscale";

        // Check if guide has complete data
        const hasCompleteData =
          userProfile &&
          guideDetails &&
          userProfile.firstName?.trim() &&
          userProfile.lastName?.trim() &&
          (guideDetails.profilePic?.secure_url || userProfile.profilePicture) &&
          guideDetails.bio?.trim() &&
          guideDetails.languages?.length > 0 &&
          guideDetails.activities?.length > 0 &&
          guideDetails.serviceLocations?.length > 0;

        if (!hasCompleteData) {
          return null; // Skip incomplete profiles
        }

        return {
          ...user,
          ...userProfile,
          ...guideDetails,
          profilePicture:
            guideDetails.profilePic?.secure_url && guideDetails.profilePic.secure_url !== ""
              ? guideDetails.profilePic.secure_url
              : userProfile.profilePicture && userProfile.profilePicture !== ""
              ? userProfile.profilePicture
              : defaultProfilePic,
          languages: guideDetails.languages?.map((lang) => lang.languageName) || [],
          activities: guideDetails.activities?.map((act) => act.activityName) || [],
          serviceLocations: guideDetails.serviceLocations?.map((city) => city.cityName) || [],
          state: userProfile.address?.stateId?.stateName || "",
          active: guideDetails.active, // Add the active field from the Guide model
        };
      })
    );

    // Filter out null entries (incomplete profiles)
    const completeGuides = guides.filter((guide) => guide !== null);

    // Filter for only active guides
    const activeGuides = completeGuides.filter((guide) => guide.active === true);

    // Apply query filters
    const filteredGuides = activeGuides.filter((guide) => {
      const matchesState = !state || guide.state?.toLowerCase().includes(state.toLowerCase());
      const matchesLanguage =
        !language || guide.languages?.some((lang) => lang.toLowerCase().includes(language.toLowerCase()));
      const matchesActivity =
        !activity || guide.activities?.some((act) => act.toLowerCase().includes(activity.toLowerCase()));
      const matchesGender = !gender || guide.gender?.toLowerCase() === gender.toLowerCase();
      const matchesCity =
        !city || guide.serviceLocations?.some((svcCity) => svcCity.toLowerCase().includes(city.toLowerCase()));

      return matchesState && matchesLanguage && matchesActivity && matchesGender && matchesCity;
    });

    res.status(200).json(filteredGuides);
  } catch (error) {
    console.error("Error fetching guides:", error.message || error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message || "Unknown error",
    });
  }
};
