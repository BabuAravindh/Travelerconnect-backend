//chat functionalities backend

import Pusher from "pusher";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import createNotification from "./notificationController.js";
// Pusher instance (same as in server.js)
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true,
});

export const sendMessage = async (req, res) => {
  try {
    const senderId = req.user._id;
    const senderRole = req.user.role;
    const { message } = req.body;
    const { id: receiverId } = req.params;

    if (!senderId || !receiverId || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    let messageType = "text";

    // Check if message is a budget message
    const budgetRegex = /^@budget\s+\d+$/i;
    if (budgetRegex.test(message)) {
      if (senderRole !== "guide") {
        return res.status(403).json({ error: "Only guides can send budget messages." });
      }
      messageType = "budget";
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] },
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [new mongoose.Types.ObjectId(senderId), new mongoose.Types.ObjectId(receiverId)],
      });
      await conversation.save();
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      message,
      timestamp: new Date().toISOString(),
      conversationId: conversation._id,
      messageType,
    });

    await newMessage.save();

    conversation.lastMessageTime = new Date();
    await conversation.save();

    // Trigger Pusher for chat
    pusher.trigger(`chat-${conversation._id}`, "new-message", {
      senderId,
      message,
      messageType,
      timestamp: newMessage.timestamp,
      conversationId: conversation._id,
    });

    // Create a notification for the receiver
    await createNotification({
      recipientId: receiverId,
      senderId,
      conversationId: conversation._id,
      type: messageType === "budget" ? "budget_message" : "new_message",
      message: messageType === "budget" ? "New budget message received" : message,
    });

    res.status(201).json({
      success: true,
      message: newMessage,
      conversationId: conversation._id,
    });
  } catch (error) {
    console.error("❌ Error sending message:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};




  


// Function to get messages for a specific conversation
export const getMessages = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log("❌ Invalid conversation ID format:", id);
      return res.status(400).json({ error: "Invalid conversation ID format" });
    }

    const conversationId = new mongoose.Types.ObjectId(id); // ✅ Convert to ObjectId

    console.log("📢 Fetching messages for conversationId:", conversationId);

    const messages = await Message.find({ conversationId })
      .populate("senderId receiverId", "name avatar") // ✅ Ensure proper population
      .lean(); // ✅ Convert Mongoose objects to plain JSON

    console.log("📢 Retrieved Messages:", messages);

    if (messages.length === 0) {
      console.log("⚠️ No messages found for this conversation.");
    }

    res.status(200).json(messages);
  } catch (error) {
    console.error("❌ Error in getMessages controller:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Function to get conversations of a specific user
export const getUserConversations = async (req, res) => {
  try {
    const { userId } = req.params;
    const token = req.headers['authorization'];
    if (!userId || !token) {
      return res.status(400).json({ message: 'User ID or Token missing' });
    }
    // Fetch all conversations where the user is a participant
    const conversations = await Conversation.find({
      participants: userId,
    }).populate("participants", "name avatar _id"); // ✅ Ensure participants are included
     console.log(conversations)    

    res.status(200).json(conversations); // Respond with the conversations
  } catch (error) {
    console.log("Error in getUserConversations controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Function to get users for the sidebar
export const getUsersForSidebar = async (req, res) => {
  try {
    const userId = req.user._id; // Get authenticated user ID

    // Find all conversations where the user is a participant
    const conversations = await Conversation.find({
      participants: userId,
    }).populate("participants", "name avatar _id");

    // Extract unique users from conversations, excluding the authenticated user
    const userSet = new Set();

    conversations.forEach((conversation) => {
      conversation.participants.forEach((participant) => {
        if (participant._id.toString() !== userId) {
          userSet.add(JSON.stringify(participant)); // Convert to string for Set uniqueness
        }
      });
    });

    // Convert Set back to an array of objects
    const users = Array.from(userSet).map((user) => JSON.parse(user));

    res.status(200).json(users);
  } catch (error) {
    console.error("Error in getUsersForSidebar controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const startConversation = async (req, res) => {
  try {
    console.log("Request received at /api/chats/startConversion:", req.body);
    
    const { senderId, receiverId } = req.body; // Destructure both from req.body

    // Validate that both senderId and receiverId are provided
    if (!senderId || !receiverId) {
      return res.status(400).json({ error: "Both senderId and receiverId are required" });
    }

    // Prevent starting a conversation with oneself (optional, depending on your requirements)
    if (senderId === receiverId) {
      return res.status(400).json({ error: "Cannot start a conversation with yourself" });
    }

    console.log(`Checking existing conversation between ${senderId} and ${receiverId}`);
    
    // Check if a conversation already exists between the two participants
    const existingConversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] },
    }).populate("participants");

    if (existingConversation) {
      // If a conversation already exists, return it without creating a new one
      console.log("Conversation already exists:", existingConversation);
      return res.status(200).json({ 
        message: "Conversation already exists",
        conversation: existingConversation 
      });
    }

    // If no conversation exists, create a new one
    console.log("No existing conversation. Creating a new one...");
    const newConversation = new Conversation({
      participants: [senderId, receiverId],
    });

    await newConversation.save();
    console.log("New conversation created:", newConversation);

    // Return the newly created conversation
    res.status(201).json({ 
      message: "Conversation started successfully",
      conversation: newConversation 
    });

  } catch (error) {
    console.error("Error starting conversation:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};



export const getLastBudgetMessage = async (req, res) => {
  try {
    const { id: conversationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ error: "Invalid conversation ID format" });
    }

    // Find the latest budget message in the conversation
    const lastBudgetMessage = await Message.findOne({
      conversationId,
      messageType: "budget", // ✅ Filter only budget messages
    })
      .sort({ timestamp: -1 }) // ✅ Get the latest budget message
      .lean();
console.log(lastBudgetMessage)
    if (!lastBudgetMessage) {
      return res.status(404).json({ message: "No budget message found" });
    }

    res.status(200).json(lastBudgetMessage);
  } catch (error) {
    console.error("❌ Error fetching last budget message:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};


export const getOrCreateConversation = async (req, res) => {
  try {
    const { userId, guideId } = req.params;

    // Validate that both userId and guideId are provided
    if (!userId || !guideId) {
      return res.status(400).json({ 
        success: false, 
        message: "Both userId and guideId are required" 
      });
    }

    // Optional: Prevent conversation with the same ID (e.g., userId === guideId)
    if (userId === guideId) {
      return res.status(400).json({ 
        success: false, 
        message: "Cannot start a conversation with the same user" 
      });
    }

    // Check if a conversation already exists between userId and guideId
    let conversation = await Conversation.findOne({
      participants: { $all: [userId, guideId] },
    }).populate("participants"); // Optional: Populate participant details if needed

    if (!conversation) {
      // Create a new conversation if none exists
      console.log(`No conversation found between ${userId} and ${guideId}. Creating a new one...`);
      conversation = new Conversation({ participants: [userId, guideId] });
      await conversation.save();
      console.log("New conversation created:", conversation._id);
      
      return res.status(201).json({ 
        success: true, 
        message: "Conversation created successfully",
        conversationId: conversation._id 
      });
    }

    // Return the existing conversation
    console.log(`Conversation already exists between ${userId} and ${guideId}:`, conversation._id);
    return res.status(200).json({ 
      success: true, 
      message: "Conversation already exists",
      conversationId: conversation._id 
    });

  } catch (error) {
    console.error("Error in getOrCreateConversation:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Server error" 
    });
  }
};
















const onlineUsers = new Set(); // In-memory storage for online users

export const setUserOnline = async (req, res) => {
  try {
    const { userId } = req.body;
    onlineUsers.add(userId);

    pusher.trigger("presence-online-users", "user-online", { userId });

    res.status(200).json({ message: "User is online" });
  } catch (error) {
    console.error("Error setting user online:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};


export const setUserOffline = async (req, res) => {
  try {
    const { userId } = req.body;
    onlineUsers.delete(userId);

    pusher.trigger("presence-online-users", "user-offline", { userId });

    res.status(200).json({ message: "User is offline" });
  } catch (error) {
    console.error("Error setting user offline:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
export const typingIndicator = async (req, res) => {
  try {
    const { conversationId, senderId, isTyping } = req.body;
  
    pusher.trigger(`chat-${conversationId}`, "typing-indicator", {
      senderId,
      isTyping,
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error in typing indicator:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};










//admin controllers 
// Get all conversations (Admin only)
export const getAllConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find()
      .populate("participants", "name avatar _id")
      .sort({ lastMessageTime: -1 }) // Sort by most recent
      .lean();

    res.status(200).json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    console.error("Error fetching all conversations:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get messages for a specific conversation (Admin only)
export const getConversationMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ error: "Invalid conversation ID format" });
    }

    const messages = await Message.find({ conversationId })
      .populate("senderId receiverId", "name avatar _id")
      .sort({ timestamp: 1 }) // Sort by oldest first
      .lean();

    res.status(200).json({
      success: true,
      data: messages,
    });
  } catch (error) {
    console.error("Error fetching conversation messages:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete a conversation (Admin only)
export const deleteConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ error: "Invalid conversation ID format" });
    }

    // Delete the conversation
    const conversation = await Conversation.findByIdAndDelete(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Optionally delete all associated messages
    await Message.deleteMany({ conversationId });

    res.status(200).json({
      success: true,
      message: "Conversation deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting conversation:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete a specific message (Admin only)
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ error: "Invalid message ID format" });
    }

    const message = await Message.findByIdAndDelete(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    res.status(200).json({
      success: true,
      message: "Message deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting message:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Update a specific message (Admin only)
export const updateMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { message, messageType, status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ error: "Invalid message ID format" });
    }

    const updatedMessage = await Message.findByIdAndUpdate(
      messageId,
      { message, messageType, status, timestamp: new Date() },
      { new: true, runValidators: true }
    )
      .populate("senderId receiverId", "name avatar _id")
      .lean();

    if (!updatedMessage) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Optionally trigger Pusher to notify users in the conversation
    pusher.trigger(`chat-${updatedMessage.conversationId}`, "message-updated", {
      ...updatedMessage,
    });

    res.status(200).json({
      success: true,
      data: updatedMessage,
    });
  } catch (error) {
    console.error("Error updating message:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
