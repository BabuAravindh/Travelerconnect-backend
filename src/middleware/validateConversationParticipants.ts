// Add this middleware to routes that need conversation validation

import Conversation from "../models/Conversation.js";

export const validateConversationParticipants = async (req, res, next) => {
    try {
      const conversationId = req.params.id;
      const conversation = await Conversation.findById(conversationId)
        .populate('participants', 'role');
  
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
  
      // Check if both participants are guides
      const isGuideToGuide = conversation.participants.every(
        participant => participant.role === 'guide'
      );
  
      if (isGuideToGuide) {
        return res.status(403).json({ 
          error: "Guide-to-guide conversations are not allowed" 
        });
      }
  
      next();
    } catch (error) {
      console.error("Error validating conversation:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };