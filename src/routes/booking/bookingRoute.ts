import express from 'express';
import {
  createBooking,
  updateBookingDetails,
  getUserBookings,
  getGuideBookings,
  getAllBookings,
  deleteBooking,

} from '../../controllers/bookingController.js';
import authenticateUser from '../../middleware/authMiddleware.js';
import { verifyAdmin } from '../../middleware/verifyAdmin.js';

const router = express.Router();

router.post('/', authenticateUser, createBooking);
router.patch('/:id/details', authenticateUser, updateBookingDetails);
router.get('/user/:userId', authenticateUser, getUserBookings);
router.get("/guide/:guideId", authenticateUser, getGuideBookings);

//admin booking routes
router.get("/admin", verifyAdmin, getAllBookings)
router.delete("/admin/delete/:id", verifyAdmin, deleteBooking)

export default router;
