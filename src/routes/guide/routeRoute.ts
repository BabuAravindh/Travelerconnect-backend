import express from 'express';
import { generateRoutes, getAllRoutes } from '../../controllers/guide/RouteController.js';

const router = express.Router();

router.post('/generate/:cityName', generateRoutes);
router.get('/', getAllRoutes);

export default router;