import express from "express"
import { adminDeleteFeedback, createFeedback, deleteFeedback, getAllFeedback, getFeedbackForGuide, getFeedbackStats } from "../../controllers/FeedbackController.js"
import authenticateUser from "../../middleware/authMiddleware.js"

const router = express.Router()

router.route('/',authenticateUser).post(createFeedback)
router.route('/:id',authenticateUser).get(getFeedbackForGuide).delete(deleteFeedback)



// Admin routes
router.get('/admin/all', getAllFeedback)
router.delete('/admin/:id', adminDeleteFeedback)
router.get('/admin/stats', getFeedbackStats)



export default router