import express from 'express';
import { createTravelPlan, getTravelPlan } from '../controllers/user/travelPlanController.js';

const router = express.Router();

// POST /api/travel-plan - Submit questions and answers, get itinerary
router.post('/', createTravelPlan);

// GET /api/travel-plan/:id - Retrieve travel plan and itinerary by ID
router.get('/:id', getTravelPlan);

export default router;