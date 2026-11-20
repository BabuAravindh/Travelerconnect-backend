import express from 'express';
import multer from 'multer';
import authenticateUser from '../../middleware/authMiddleware.js';
import {
  createCityItems,
  confirmCityItems,
  getAllCityItems,
  getAttractionById,
  uploadImage, // Add new endpoint
} from '../../controllers/guide/AttractionController.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1, // Single file for manual upload
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
});

router.post('/create-items', authenticateUser, upload.array('images', 30), createCityItems);
router.post('/confirm-items', authenticateUser, confirmCityItems);
router.get('/', getAllCityItems);
router.get('/:id', getAttractionById);
router.post('/upload-image', authenticateUser, upload.single('image'), uploadImage); // New endpoint

export default router;