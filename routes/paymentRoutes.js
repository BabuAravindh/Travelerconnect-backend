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
} from '../controllers/paymentController.js';

const router = express.Router();
// At the top of paymentController.js
import multer from 'multer';
export const upload = multer({ storage: multer.memoryStorage() });

// Initialize payment
router.post('/initiate', initiatePayment);

// Verify payment (webhook or frontend callback)
router.post('/verify', verifyPayment);


router.post(
  '/cash',
  (req, res, next) => {
    console.log('🔁 Uploading manual payment screenshot...');
    next();
  },
  upload.single('screenshot'),
  recordManualPayment
);

// Get payment history
router.get('/history/:bookingId', getBookingPayments);

// Update payment status for guide
router.put('/guide/:paymentId',updatePaymentStatus)

router.get('/guide/:guideId',getGuidePaymentHistory)
router.get('/booking/:userId', getUserPaymentDetails);
router.put('/:paymentId/status',updateManualPaymentStatus)
router.get('/:paymentId', getSinglePaymentDetails);

export default router;