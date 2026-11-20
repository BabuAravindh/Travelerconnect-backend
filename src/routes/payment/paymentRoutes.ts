import express from 'express';
import {
  initiatePayment,
  verifyPayment,
  getBookingPayments,
  recordManualPayment,
  updatePaymentStatus,

  getSinglePaymentDetails,
  getUserPaymentDetails,
  getGuidePaymentHistory,
  updateManualPaymentStatus
} from '../../controllers/paymentController.js';
import authenticateUser from '../../middleware/authMiddleware.js';
import { verifyAdmin } from '../../middleware/verifyAdmin.js';

const router = express.Router();
// At the top of paymentController.js
import multer from 'multer';
export const upload = multer({ storage: multer.memoryStorage() });

// Initialize payment
router.post('/initiate', authenticateUser, initiatePayment);

// Verify payment (webhook or frontend callback)
router.post('/verify', authenticateUser, verifyPayment);


router.post(
  '/cash',
  authenticateUser,
  upload.single('screenshot'),
  recordManualPayment
);

// Get payment history
router.get('/history/:bookingId', authenticateUser, getBookingPayments);

// Update payment status for guide (manual admin override only — real verification happens in /verify)
router.put('/guide/:paymentId', verifyAdmin, updatePaymentStatus)

router.get('/guide/:guideId', authenticateUser, getGuidePaymentHistory)
router.get('/booking/:userId', authenticateUser, getUserPaymentDetails);
router.put('/:paymentId/status', verifyAdmin, updateManualPaymentStatus)
router.get('/:paymentId', authenticateUser, getSinglePaymentDetails);

export default router;