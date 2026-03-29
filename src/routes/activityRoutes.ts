import express from 'express';
import {
  createActivity,
  getActivities,
  updateActivity,
  deleteActivity,
} from '../controllers/activityController.js';

const router = express.Router();

router.post('/', createActivity);
router.get('/', getActivities);
router.put('/:id', updateActivity); // Update activity
router.delete('/:id', deleteActivity); // Delete activity

export default router;
