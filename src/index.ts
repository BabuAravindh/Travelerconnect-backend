import "dotenv/config";

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import { Server } from "socket.io";
import http from "http";

// Routes
import authRoutes from "./routes/authRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import activityRoutes from "./routes/activityRoutes.js"
import chatRoutes from "./routes/chatRoute.js";
import requestRoutes from "./routes/requestRoute.js";
import bookingRoutes from "./routes/bookingRoute.js";
import GuideRoutes from './routes/guide/guideRoutes.js';
import GuideProfileRoutes from './routes/guide/profileGuide.js';

import aiRoutes from "./routes/aiRoute.js"
import predefineRoutes from './routes/prefinedRoutes.js'
// import paymentRoute from './routes/paymentRoutes.js'

import feedbackRoutes from "./routes/feedbackRoutes.js"

//search route import
import searchRoutes from "./routes/Search_and_filters/search.js"

//payment routes
import paymentRoutes from "./routes/paymentRoutes.js"
import AttractionsRoutes from "./routes/guide/attractionRoutes.js";
import { fetch } from 'undici';

import routes from "./routes/guide/routeRoute.js";

import adminPaymentRoutes from "./routes/admin/payment.js"

import contactRoutes from './routes/contact.js'

import adminUserRoutes from './routes/admin/userRoute.js'

import adminRefundRoutes from './routes/admin/refundRoutes.js'

import notificationRoutes from "./routes/notificationroute.js";

import travelPlanRoutes from "./routes/travelPlanRoutes.js";
import { clearCache } from "./utils/cache.js";
// Express App Setup
const app = express();
const server = http.createServer(app);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS","PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Routes
app.use("/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/activities",activityRoutes)
app.use("/api/guide", GuideRoutes);
app.use("/api/guide/profile", GuideProfileRoutes);
app.use("/api",aiRoutes)
app.use("/api/predefine",predefineRoutes)
//feedbackroutes
app.use("/api/feedback",feedbackRoutes)
//search routes
app.use("/api/search",searchRoutes)
//payment routes
app.use("/api/payment",paymentRoutes)
app.use('/api/attractions', AttractionsRoutes)
app.use("/api/routes", routes)
app.use("/api/payment", paymentRoutes);
app.use("/api/payments/admin",adminPaymentRoutes)
app.use("/api/contact",contactRoutes)
app.use("/api/admin",adminUserRoutes)
app.use("/api/refund",adminRefundRoutes)
app.use("/api/notifications", notificationRoutes);
//travel plan routes
app.use("/api/travelPlan", travelPlanRoutes);



mongoose
  .connect(process.env.MONGO_URI as any, {
    connectTimeoutMS: 10000, 
    socketTimeoutMS: 45000,  
  })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });



// WebSocket Setup
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const userSocketMap = {}; // Map userId to socketId

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", (userId) => {
    userSocketMap[userId] = socket.id;
    console.log(`User ${userId} connected with socket ${socket.id}`);
  });

  socket.on("send-message", ({ conversationId, senderId, receiverId, message }) => {
    const receiverSocket = userSocketMap[receiverId];
    if (receiverSocket) {
      io.to(receiverSocket).emit("receive-message", { conversationId, senderId, message });
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    const userId = Object.keys(userSocketMap).find((key) => userSocketMap[key] === socket.id);
    if (userId) {
      delete userSocketMap[userId];
    }
  });
});

clearCache()
// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

export { io, userSocketMap };
