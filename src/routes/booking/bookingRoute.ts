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

const router = express.Router();

router.post('/', authenticateUser, createBooking);
router.patch('/:id/details', updateBookingDetails);
router.get('/user/:userId', authenticateUser, getUserBookings);
router.get("/guide/:guideId", authenticateUser, getGuideBookings);

//admin booking routes
router.get("/admin",getAllBookings)
router.delete("/admin/delete/:id", deleteBooking)

export default router;
