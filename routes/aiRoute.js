import express from 'express';
import {
  saveAiIntegration,
  getAichatResponsesByUserId,
  saveCreditHistory,
  getCreditHistory,
  getCityInsights,
  requestAiCredits,
  approveCreditRequest,
  getAllCreditRequests,
  getAllAiInteractions,
  getAllCreditRecords,
  getCurrentCredit,
} from '../controllers/aiController.js';
import authenticateUser from '../middleware/authMiddleware.js'; // Your middleware
import { validateAiIntegration, validateCityInsights, validateCreditHistory, validateCreditRequest } from '../middleware/validateMiddleware.js';

// Admin middleware to check role
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Admin access required',
    });
  }
  next();
};

const router = express.Router();

// User-facing routes (require authentication)
router.post('/ai', authenticateUser, validateAiIntegration, saveAiIntegration);
router.post('/ai/city-insights', authenticateUser, validateCityInsights, getCityInsights);
router.get('/ai/:userId', authenticateUser, getAichatResponsesByUserId);
// Get current credit balance for a user
router.get('/ai/credit/balance/:userId', authenticateUser, getCurrentCredit);

// AI Credit routes (require authentication)
router.post('/api/credit', authenticateUser, validateCreditHistory, saveCreditHistory);
router.get('/credit/:userId', authenticateUser, getCreditHistory);
router.post('/credit/request', authenticateUser, validateCreditRequest, requestAiCredits);

// Admin routes (require admin role)
router.get('/admin/ai-interactions', authenticateUser, requireAdmin, getAllAiInteractions);
router.get('/admin/credit-records', authenticateUser, requireAdmin, getAllCreditRecords);
router.get('/admin/credit-requests', authenticateUser, requireAdmin, getAllCreditRequests);
router.post('/admin/credit-requests/approve/:requestId', authenticateUser, requireAdmin, approveCreditRequest);

export default router;