import express from "express";
import createNotification, {
  getUnreadNotifications,
  markNotificationsAsRead,
  getAllNotifications,
  clearAllNotifications,
} from "../../controllers/notificationController.js";
import authenticateUser from "../../middleware/authMiddleware.js";

const router = express.Router();
router.post("/create", authenticateUser, async (req, res) => {
  const { recipientId, senderId, conversationId, type, message, senderRole } = req.body;
  const result = await createNotification({ recipientId, senderId, conversationId, type, message, senderRole });
  res.status(result.success ? 201 : 400).json(result);
});
// Get unread notifications
router.get("/unread/:userId", authenticateUser, getUnreadNotifications);

// Mark notifications as read
router.put("/read/:userId", authenticateUser, markNotificationsAsRead);

// Get all notifications
router.get("/:userId", authenticateUser, getAllNotifications);

// Clear all notifications
router.delete("/clear/:userId", authenticateUser, clearAllNotifications);

export default router;