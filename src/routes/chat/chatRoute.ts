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
import User from "../../models/User.js";
import Guide from "../../models/Guide.js";
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
router.post("/startConversation", startConversation);

// Get the budget from the last message
router.get("/conversations/:id/lastBudget", authenticateUser, getLastBudgetMessage);
router.get("/conversation/:userId/:guideId", getOrCreateConversation);

router.post("/online", setUserOnline);
router.post("/offline", setUserOffline);
router.post("/typing", typingIndicator);

router.get("/profile/:userId", async (req, res) => {
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

router.post("/auth", (req, res) => {
  const { socket_id, channel_name } = req.body;
  ("Socket ID:", socket_id);
  ("Channel Name:", channel_name);

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
    ("Decoded JWT:", decoded);
    const userId = decoded.id;

    const expectedChannel = `private-notifications-${userId}`;
    if (channel_name !== expectedChannel) {
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
router.get("/admin/conversations", getAllConversations);
router.get("/admin/conversations/:conversationId", getConversationMessages);
router.delete("/admin/conversations/:conversationId", deleteConversation);
router.delete("/admin/messages/:messageId", deleteMessage);

export default router;