// config/cloudinary.js
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

// Configure Cloudinary with environment variables
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true // Always use HTTPS
});

// Custom upload function for government IDs
export const uploadGovernmentId = async (filePath) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: 'government_ids',
      resource_type: 'auto', // Automatically detect if it's image or PDF
      allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
      transformation: [
        { quality: 'auto:best' },
        { flags: 'attachment' } // For PDF downloads
      ],
      moderation: 'manual', // Optional: Enable manual review if needed
      tags: ['government_id', 'verification']
    });
    
    return {
      public_id: result.public_id,
      url: result.url,
      secure_url: result.secure_url,
      format: result.format,
      width: result.width,
      height: result.height,
      pages: result.pages // For PDFs
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('Failed to upload document to Cloudinary');
  }
};

// Utility function to delete uploaded files
export const deleteCloudinaryFile = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image' // or 'raw' for PDFs
    });
  } catch (error) {
    console.error('Cloudinary deletion error:', error);
    throw new Error('Failed to delete file from Cloudinary');
  }
};

export default cloudinary;