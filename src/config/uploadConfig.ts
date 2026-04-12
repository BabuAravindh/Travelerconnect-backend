// config/uploadConfig.ts
import multer from "multer";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(new Error("Only JPG, PNG, or PDF files are allowed"));
    }
    cb(null, true);
  },
});