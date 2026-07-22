import User from "../../models/User.js";
import GuideRequest from "../../models/GuideRequest.js";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { promises as fs } from 'fs';
import { fetch } from 'undici'
// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  httpAgent: new HttpAgent({ timeout: 180000 }),
  httpsAgent: new HttpsAgent({ timeout: 18000 }),
});

// Configure multer for file upload
const upload = multer({ storage: multer.memoryStorage() });
const checkNetwork = async () => {
  try {
    const response = await fetch('https://www.google.com', { method: 'HEAD', timeout: 2000 });
    return response.ok;
  } catch {
    throw new Error('Network unstable or offline');
  }
};

// Cloudinary service status check
const checkCloudinaryStatus = async () => {
  try {
    const response = await fetch('https://status.cloudinary.com/api/v2/status.json');
    const { status } = await response.json();
    if (status.indicator !== 'none') {
      throw new Error(`Cloudinary service issue: ${status.description}`);
    }
    return true;
  } catch (err) {
    throw new Error(`Failed to check Cloudinary status: ${err.message}`);
  }
};

// Upload to Cloudinary with debug logging
const uploadToCloudinaryWithDebug = async (fileBuffer, folder) => {
  // Validate Cloudinary config
  if (!cloudinary.config().cloud_name || !cloudinary.config().api_key) {
    throw new Error('Cloudinary configuration missing');
  }

  // Test API connectivity
  try {
    await cloudinary.api.resource_type('upload');
    ('Cloudinary API connectivity confirmed');
  } catch (err) {
    throw new Error(`Cloudinary API check failed: ${err.message}`);
  }

  return new Promise((resolve, reject) => {
    (`Initiating upload to ${folder}, Buffer size: ${(fileBuffer.length / 1024).toFixed(2)} KB`);
    const startTime = Date.now();

    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, timeout: 15000 },
      (error, result) => {
        const elapsedTime = (Date.now() - startTime) / 1000;
        if (error) {
          console.error(`Upload failed after ${elapsedTime}s:`, {
            message: error.message,
            http_code: error.http_code || 'N/A',
            name: error.name,
            stack: error.stack,
            timeout: cloudinary.config().timeout || 'Unknown',
          });
          reject(error);
        } else {
          (`Upload succeeded after ${elapsedTime}s:`, result.secure_url);
          resolve(result);
        }
      }
    );

    uploadStream.end(fileBuffer);
  });
};

// Retry logic for uploads
const uploadWithRetry = async (fileBuffer, folder, retries = 5) => {
  try {
    await checkCloudinaryStatus();
    await checkNetwork();
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await uploadToCloudinaryWithDebug(fileBuffer, folder);
      } catch (error) {
        console.warn(`Upload attempt ${attempt} failed for ${folder}:`, error.message);
        if (attempt === retries) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  } catch (error) {
    console.error('All upload attempts failed, saving locally');
    const fallbackPath = `./fallback/${folder}/${Date.now()}.png`;
    await fs.mkdir(`./fallback/${folder}`, { recursive: true });
    await fs.writeFile(fallbackPath, fileBuffer);
    throw new Error(`Upload failed, saved locally at ${fallbackPath}: ${error.message}`);
  }
};
export const becomeGuide = async (req, res) => {
  try {
    // Log Cloudinary config and test connectivity (unchanged)
    ("Cloudinary Config:", {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET ? "Set" : "Not Set",
      timeout: 180000,
    });

    ("Testing Cloudinary connectivity...");
    const pingStart = Date.now();
    try {
      const resources = await cloudinary.api.resources({ max_results: 1 });
      (`Cloudinary API ping succeeded after ${(Date.now() - pingStart) / 1000}s:`, resources);
    } catch (pingError) {
      console.error(`Cloudinary API ping failed after ${(Date.now() - pingStart) / 1000}s:`, pingError.message);
    }

    // Handle file upload
    let aadharPhotoUrl = "";
    if (req.file) {
      (`Aadhar Card Photo received for user ${req.body.userId}: ${req.file.originalname}, Size: ${(req.file.buffer.length / 1024 / 1024).toFixed(2)} MB`);
      const result = await uploadWithRetry(req.file.buffer, "aadhar_cards");
      aadharPhotoUrl = result.secure_url;
      (`Aadhar Card Photo uploaded for user ${req.body.userId}: ${aadharPhotoUrl}`);
    }

    // Extract form data
    const { userId, languages, activities, serviceLocations, cities, bankAccountNumber, bio } = req.body;

    // Check if the user exists
    const existingUser = await User.findById(userId);
    if (!existingUser) {
      return res.status(404).json({ message: "User not found. Please register first." });
    }

    // Check if user is already a guide
    if (existingUser.role === "guide") {
      return res.status(400).json({ message: "You are already a guide." });
    }

    // Check for existing pending or approved requests
    const existingRequest = await GuideRequest.findOne({
      userId,
      status: { $in: ["pending", "approved"] },
    });
    if (existingRequest) {
      return res.status(400).json({
        message: existingRequest.status === "pending"
          ? "You already have a pending guide request."
          : "You are already a guide.",
      });
    }

    // Normalize arrays
    const languagesArray = Array.isArray(languages) ? languages : [languages];
    const activitiesArray = Array.isArray(activities) ? activities : [activities];
    const statesArray = Array.isArray(serviceLocations) ? serviceLocations : [serviceLocations]; // Rename to states
    const citiesArray = Array.isArray(cities) ? cities : [cities];

    // Create new guide request
    const newGuideRequest = new GuideRequest({
      userId,
      languages: languagesArray,
      activities: activitiesArray,
      states: statesArray, // Use states instead of serviceLocations
      cities: citiesArray,
      aadharCardPhoto: aadharPhotoUrl,
      bankAccountNumber,
      bio,
      status: "pending",
    });

    await newGuideRequest.save();

    res.status(201).json({
      message: "Guide request submitted successfully. It will be reviewed by our team.",
      requestId: newGuideRequest._id,
    });
  } catch (error) {
    console.error("Error in becomeGuide:", error.message || error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Validation error",
        errors: error.errors,
      });
    }
    if (error.code === "ETIMEDOUT" || error.message.includes("timeout")) {
      return res.status(504).json({
        message: "Request timed out while uploading file to Cloudinary. Check network or Cloudinary status.",
        error: error.message,
      });
    }
    res.status(500).json({
      message: "Server error. Please try again.",
      error: error.message || "Unknown error",
    });
  }
};
// Middleware for file upload
export const uploadMiddleware = upload.single("aadharCardPhoto");

// Other functions remain unchanged
export const getGuideRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      query.status = status;
    }

    const guideRequests = await GuideRequest.find(query)
      .populate({
        path: "userId",
        select: "firstName lastName email profilePicture",
      })
      .populate({
        path: "languages",
        select: "languageName languageStatus",
      })
      .populate({
        path: "states", // Changed from serviceLocations to states
        model: "State", // Assuming your model is named "State"
        select: "stateName",
      })
      .populate({
        path: "cities",
        model: "City",
        select: "cityName",
      })
      .sort({ submittedAt: -1 });

    res.status(200).json({
      success: true,
      count: guideRequests.length,
      data: guideRequests,
    });
  } catch (error) {
    console.error("Error fetching guide requests:", error.message || error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch guide requests",
      error: error.message || "Unknown error",
    });
  }
};
export const reviewGuideRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status, reviewNotes } = req.body;

    // Validate status
    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value. Must be 'approved' or 'rejected'" });
    }

    // Find the guide request
    const guideRequest = await GuideRequest.findById(requestId);
    if (!guideRequest) {
      return res.status(404).json({ message: "Guide request not found" });
    }

    // Check if already processed
    if (guideRequest.status !== "pending") {
      return res.status(400).json({
        message: `Request has already been ${guideRequest.status}`,
      });
    }

    // Update the guide request
    guideRequest.status = status;
    guideRequest.reviewedAt = new Date();
    guideRequest.reviewNotes = reviewNotes || "";

    await guideRequest.save();

    res.status(200).json({
      success: true,
      message: `Guide request ${status} successfully`,
      data: {
        requestId: guideRequest._id,
        status: guideRequest.status,
        reviewedAt: guideRequest.reviewedAt,
      },
    });
  } catch (error) {
    console.error("Error reviewing guide request:", error.message || error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.errors,
      });
    }
    res.status(500).json({
      success: false,
      message: "Server error. Please try again.",
      error: error.message || "Unknown error",
    });
  }
};