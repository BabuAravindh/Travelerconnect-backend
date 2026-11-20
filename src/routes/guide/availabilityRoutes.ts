import express from 'express';
import { addAvailability, getAvailability, bookGuide } from '../../controllers/availabilityController.js';
import authenticateUser from '../../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', authenticateUser, addAvailability);
router.get('/:guideId', authenticateUser, getAvailability);
router.patch('/:guideId/book', authenticateUser, bookGuide);

export default router;
