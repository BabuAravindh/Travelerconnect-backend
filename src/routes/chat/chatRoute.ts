import express from "express";
import jwt from "jsonwebtoken";
import {
  deleteConversation,
  deleteMessage,
  getAllConversations,
  getConversationMessages,
  getLastBudgetMessage,
  getMessages,
  getOrCreateConversation,
  getUserConversations,
  getUsersForSidebar,
  sendMessage,
  setUserOffline,
  setUserOnline,
  startConversation,
  typingIndicator,
  updateMessage,
} from "../../controllers/chatController.js";
import authenticateUser from "../../middleware/authMiddleware.js";
import { verifyAdmin } from "../../middleware/verifyAdmin.js";
import User from "../../models/User.js";
import Guide from "../../models/Guide.js";
import Conversation from "../../models/Conversation.js";
import dotenv from "dotenv";
import Pusher from "pusher";

dotenv.config();

const router = express.Router();

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true,
});

// Protect the routes with authenticateUser middleware
router.get("/", authenticateUser, getUsersForSidebar);
router.get("/:id", authenticateUser, getMessages);
router.post("/send/:id", authenticateUser, sendMessage);
router.get("/user/:userId", authenticateUser, getUserConversations);
router.post("/startConversation", authenticateUser, startConversation);

// Get the budget from the last message
router.get("/conversations/:id/lastBudget", authenticateUser, getLastBudgetMessage);
router.get("/conversation/:userId/:guideId", authenticateUser, getOrCreateConversation);

router.post("/online", authenticateUser, setUserOnline);
router.post("/offline", authenticateUser, setUserOffline);
router.post("/typing", authenticateUser, typingIndicator);

router.get("/profile/:userId", authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select("name email profilePic role");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const guide = await Guide.findOne({ userId }).select("bio");

    const userInfo = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      bio: guide?.bio || "No bio available",
    };

    res.json(userInfo);
  } catch (error) {
    console.error("Error fetching user info:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/auth", async (req, res) => {
  const { socket_id, channel_name } = req.body;

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Invalid token format" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const notificationsChannel = `private-notifications-${userId}`;
    const chatChannelMatch = channel_name.match(/^private-chat-([a-fA-F0-9]{24})$/);

    let authorized = channel_name === notificationsChannel;

    if (!authorized && chatChannelMatch) {
      const conversationId = chatChannelMatch[1];
      const conversation = await Conversation.findById(conversationId);
      authorized = !!conversation?.participants?.some((p) => p.toString() === userId);
    }

    if (!authorized) {
      return res.status(403).json({ error: "Unauthorized channel access" });
    }

    const authResponse = pusher.authenticate(socket_id, channel_name);
    return res.send(authResponse);
  } catch (err) {
    console.error("JWT verification failed:", err);
    return res.status(403).json({ error: "Invalid or expired token" });
  }
});

// Admin-only routes
router.get("/admin/conversations", verifyAdmin, getAllConversations);
router.get("/admin/conversations/:conversationId", verifyAdmin, getConversationMessages);
router.delete("/admin/conversations/:conversationId", verifyAdmin, deleteConversation);
router.delete("/admin/messages/:messageId", verifyAdmin, deleteMessage);

export default router;