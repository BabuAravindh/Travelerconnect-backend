import express from "express";

// Auth routes
import authRoutes from "./auth/authRoutes.js";

// User routes
import profileRoutes from "./user/profileRoutes.js";

// Guide routes
import GuideRoutes from "./guide/guideRoutes.js";
import GuideProfileRoutes from "./guide/profileGuide.js";
import AttractionsRoutes from "./guide/attractionRoutes.js";
import routeRoutes from "./guide/routeRoute.js";

// Booking routes
import bookingRoutes from "./booking/bookingRoute.js";
import requestRoutes from "./booking/requestRoute.js";

// Chat routes
import chatRoutes from "./chat/chatRoute.js";

// Payment routes
import paymentRoutes from "./payment/paymentRoutes.js";

// Admin routes
import adminPaymentRoutes from "./admin/payment.js";
import adminUserRoutes from "./admin/userRoute.js";
import adminRefundRoutes from "./admin/refundRoutes.js";

// AI routes
import aiRoutes from "./ai/aiRoute.js";

// Search routes
import searchRoutes from "./search/search.js";

// Notification routes
import notificationRoutes from "./notification/notificationRoutes.js";

// Travel routes
import travelPlanRoutes from "./travel/travelPlanRoutes.js";

// Feedback routes
import feedbackRoutes from "./feedback/feedbackRoutes.js";

// Contact routes
import contactRoutes from "./contact/contact.js";

// Predefined routes
import predefineRoutes from "./predefined/prefinedRoutes.js";

// Activity routes
import activityRoutes from "./activity/activityRoutes.js";

const router = express.Router();

// Auth
router.use("/auth", authRoutes);

// User
router.use("/api/profile", profileRoutes);

// Guide
router.use("/api/guide", GuideRoutes);
router.use("/api/guide/profile", GuideProfileRoutes);
router.use("/api/attractions", AttractionsRoutes);
router.use("/api/routes", routeRoutes);

// Booking
router.use("/api/bookings", bookingRoutes);
router.use("/api/requests", requestRoutes);

// Chat
router.use("/api/chats", chatRoutes);

// Payment
router.use("/api/payment", paymentRoutes);

// Admin
router.use("/api/payments/admin", adminPaymentRoutes);
router.use("/api/admin", adminUserRoutes);
router.use("/api/refund", adminRefundRoutes);

// AI
router.use("/api", aiRoutes);

// Search
router.use("/api/search", searchRoutes);

// Notification
router.use("/api/notifications", notificationRoutes);

// Travel
router.use("/api/travelPlan", travelPlanRoutes);

// Feedback
router.use("/api/feedback", feedbackRoutes);

// Contact
router.use("/api/contact", contactRoutes);

// Predefined
router.use("/api/predefine", predefineRoutes);

// Activity
router.use("/api/activities", activityRoutes);

export default router;
