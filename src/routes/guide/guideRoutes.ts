import express from "express";
import {becomeGuide, getGuideRequests, reviewGuideRequest, uploadMiddleware } from "../../controllers/guide/GuideController.js";  // Ensure the path is correct
import Guide from "../../models/Guide.js";
import {City }from "../../models/predefineSchemas.js"
const router = express.Router();
import Booking from "../../models/bookingModel.js";
import Feedback from "../../models/feedbackModel.js";
import Message from "../../models/Message.js";
import Conversation from "../../models/Conversation.js";
// Define the POST route for becoming a guide
router.post("/become-guide",uploadMiddleware, becomeGuide);
router.get("/requests", getGuideRequests);
router.put("/requests/:requestId/review",reviewGuideRequest);

router.get("/cities_with_guides", async (req, res) => {
    try {
      // Fetch all cities
      const cities = await City.find();
  
      // Fetch guide count per city using serviceLocations (which are ObjectIds)
      const cityData = await Promise.all(
        cities.map(async (city) => {
          const guideCount = await Guide.countDocuments({
            serviceLocations: city._id, // Match the ObjectId
          });
          return {
            cityName: city.cityName,
            guideCount,
          };
        })
      );
  
      res.status(200).json(cityData);
    } catch (error) {
      console.error("Error fetching cities with guides:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
// Updated GET /api/guide/:guideId/stats endpoint
router.get("/:guideId/stats", async (req, res) => {
  try {
    const { guideId } = req.params;

    // Fetch all bookings related to the guide
    const bookings = await Booking.find({ guideId });

    // Fetch all reviews related to the guide
    const reviews = await Feedback.find({ guideId });

    // Calculate stats
    const totalBookings = bookings.length;
    const totalEarnings = bookings.reduce((sum, booking) => sum + (booking.amount || 0), 0);
    const totalReviews = reviews.length;
    const averageRating = totalReviews
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews
      : 0;

    // Fetch recent conversations (last 5) with the guide as participant
    const conversations = await Conversation.find({
      participants: guideId
    })
    .sort({ updatedAt: -1 }) // Most recent first
    .limit(5)
    .populate({
      path: 'participants',
      select: 'username profilePicture'
    })
    .populate({
      path: 'messages',
      options: { sort: { timestamp: -1 }, limit: 1 } // Get only the latest message
    });

    // Format conversations data
    const recentConversations = conversations.map(conv => {
      const otherParticipant = conv.participants.find(p => p._id.toString() !== guideId);
      const latestMessage = conv.messages[0] || null;
      
      return {
        conversationId: conv._id,
        participant: {
          id: otherParticipant?._id,
          name: otherParticipant?.username,
          avatar: otherParticipant?.profilePicture
        },
        latestMessage: latestMessage ? {
          text: latestMessage.message,
          timestamp: latestMessage.timestamp,
          isOwn: latestMessage.senderId.toString() === guideId
        } : null,
        unreadCount: 0 // You can implement this based on your read status logic
      };
    });

    res.json({
      guideId,
      totalBookings,
      totalEarnings,
      averageRating: parseFloat(averageRating.toFixed(2)),
      totalReviews,
      recentConversations
    });
  } catch (error) {
    console.error("Error fetching guide stats:", error);
    res.status(500).json({ message: "Server error", error });
  }
});

export default router;
