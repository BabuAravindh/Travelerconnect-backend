import Notification from "../models/Notification.js";
import Pusher from "pusher";
import mongoose from "mongoose";

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true,
});

const createNotification = async ({ recipientId, senderId, conversationId, type, message, senderRole }) => {
  try {
    if (type === "budget_message" && senderRole !== "guide") {
      return { success: false, error: "Only guides can send budget notifications" };
    }

    const notification = new Notification({
      recipientId,
      senderId,
      conversationId,
      type,
      message,
    });

    await notification.save();
    ("Notification created:", notification);

    const populatedNotification = await Notification.findById(notification._id)
      .populate("senderId", "name avatar _id")
      .lean();

    try {
      await pusher.trigger(`private-notifications-${recipientId}`, "new-notification", {
        _id: notification._id,
        recipientId,
        senderId: populatedNotification.senderId,
        conversationId,
        type,
        message,
        isRead: notification.isRead,
        timestamp: notification.timestamp,
      });
      (`Pusher triggered for ${recipientId} with notification data`, {
        _id: notification._id,
        message,
      });
    } catch (pusherError) {
      console.error("Pusher trigger failed:", pusherError);
      return { success: false, error: `Notification created but Pusher trigger failed: ${pusherError.message}` };
    }

    return { success: true, data: populatedNotification };
  } catch (error) {
    console.error("Error creating notification:", error);
    return { success: false, error: error.message };
  }
};

export const getUnreadNotifications = async (req, res) => {
  try {
    const userId = req.params.userId;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: "Invalid or missing userId" });
    }

    const notifications = await Notification.find({
      recipientId: userId,
      isRead: false,
    })
      .populate("senderId", "name avatar _id")
      .sort({ timestamp: -1 })
      .lean();

    ("Fetched unread notifications for userId:", userId, notifications);

    res.status(200).json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    console.error("Error fetching unread notifications:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

export const markNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.params.userId;
    const { notificationIds } = req.body;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: "Invalid or missing userId" });
    }

    if (!notificationIds || !Array.isArray(notificationIds)) {
      return res.status(400).json({ success: false, error: "Invalid or missing notification IDs" });
    }

    const validIds = notificationIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length === 0) {
      return res.status(400).json({ success: false, error: "No valid notification IDs provided" });
    }

    await Notification.updateMany(
      {
        _id: { $in: validIds },
        recipientId: userId,
      },
      { isRead: true }
    );

    try {
      await pusher.trigger(`private-notifications-${userId}`, "notifications-read", {
        notificationIds: validIds,
      });
    } catch (pusherError) {
      console.error("Pusher trigger failed for notifications-read:", pusherError);
    }

    res.status(200).json({
      success: true,
      message: "Notifications marked as read",
    });
  } catch (error) {
    console.error("Error marking notifications as read:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

export const getAllNotifications = async (req, res) => {
  try {
    const userId = req.params.userId;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: "Invalid or missing userId" });
    }

    const notifications = await Notification.find({
      recipientId: userId,
    })
      .populate("senderId", "name avatar _id")
      .sort({ timestamp: -1 })
      .lean();

    ("Fetched all notifications for userId:", userId, notifications);

    res.status(200).json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    console.error("Error fetching all notifications:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

export const clearAllNotifications = async (req, res) => {
  try {
    const userId = req.params.userId;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: "Invalid or missing userId" });
    }

    await Notification.deleteMany({ recipientId: userId });

    try {
      await pusher.trigger(`private-notifications-${userId}`, "notifications-cleared", {});
    } catch (pusherError) {
      console.error("Pusher trigger failed for notifications-cleared:", pusherError);
    }

    res.status(200).json({
      success: true,
      message: "All notifications cleared",
    });
  } catch (error) {
    console.error("Error clearing notifications:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

export default createNotification;