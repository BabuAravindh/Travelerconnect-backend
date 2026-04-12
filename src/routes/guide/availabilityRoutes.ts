import express from 'express';
import { addAvailability, getAvailability, bookGuide } from '../../controllers/availabilityController.js';

const router = express.Router();

router.post('/', addAvailability); 
router.get('/:guideId', getAvailability);
router.patch('/:guideId/book', bookGuide);

export default router;
