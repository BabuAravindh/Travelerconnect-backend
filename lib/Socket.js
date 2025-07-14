import { Server } from "socket.io";
import http from "http";
import express from "express";
import Conversation from "../models/Conversation.js";  // Adjust the path as necessary
import Message from "../models/Message.js";  // Adjust the path as necessary

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // Allow frontend connections
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const userSocketMap = {}; // { userId: socketId }

// Helper function to get receiver's socket ID
const getReceiverSocketId = (receiverId) => userSocketMap[receiverId] || null;

export const chatSocket = () => {
  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);
  
    const userId = socket.handshake.query.userId;
    if (userId && userId !== "undefined") {
      userSocketMap[userId] = socket.id;
      console.log(`User ${userId} connected with socket ID ${socket.id}`);
    }
  
    // Listen for the 'send-message' event
    socket.on("send-message", async ({ conversationId, message }) => {
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) return;
    
      const newMessage = new Message({
        senderId: message.senderId,
        receiverId: conversation.participants.find((p) => p !== message.senderId),
        message: message.message,
        conversationId,
      });
    
      await newMessage.save();
    
      // Emit the new message to both participants in the conversation
      conversation.participants.forEach((participant) => {
        const receiverSocketId = userSocketMap[participant];
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("new-message", { conversationId, message });
        }
      });
    });
    
  
    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      if (userId) {
        delete userSocketMap[userId];
        io.emit("getOnlineUsers", Object.keys(userSocketMap));
      }
    });
  });
  
  
  
};

// ✅ Export necessary items
export { app, io, server, getReceiverSocketId };
