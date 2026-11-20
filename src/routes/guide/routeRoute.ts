import express from 'express';
import { generateRoutes, getAllRoutes } from '../../controllers/guide/routeController.js';
import authenticateUser from '../../middleware/authMiddleware.js';

const router = express.Router();

router.post('/generate/:cityName', authenticateUser, generateRoutes);
router.get('/', getAllRoutes);

export default router;