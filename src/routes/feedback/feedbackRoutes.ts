import express from "express"
import { adminDeleteFeedback, createFeedback, deleteFeedback, getAllFeedback, getFeedbackForGuide, getFeedbackStats } from "../../controllers/FeedbackController.js"
import authenticateUser from "../../middleware/authMiddleware.js"
import { verifyAdmin } from "../../middleware/verifyAdmin.js"

const router = express.Router()

router.route('/').post(authenticateUser, createFeedback)
router.route('/:id').get(authenticateUser, getFeedbackForGuide).delete(authenticateUser, deleteFeedback)



// Admin routes
router.get('/admin/all', verifyAdmin, getAllFeedback)
router.delete('/admin/:id', verifyAdmin, adminDeleteFeedback)
router.get('/admin/stats', verifyAdmin, getFeedbackStats)



export default router