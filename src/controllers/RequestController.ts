// controllers/requestController.js
import Request from '../models/RequestModel.js';
import { findOrCreateConversation } from './chatController.js';
// Create a new request
export const createRequest = async (req, res) => {
  try {
    const { customerId, guideId, paymentStatus } = req.body;

    if (customerId !== req.user?._id?.toString()) {
      return res.status(403).json({ error: "You can only create requests for yourself" });
    }

    // ✅ Check if a request already exists between the same customer and guide
    const existingRequest = await Request.findOne({ customerId, guideId, status: "pending" });

    if (existingRequest) {
      return res.status(200).json({ message: "You have already sent a request. Try again later." });
    }

    // ✅ Create a new request if none exist
    const newRequest = await Request.create({ customerId, guideId, paymentStatus, status: "pending" });

    res.status(201).json(newRequest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// Fetch requests for a guide
export const getRequestsForGuide = async (req, res) => {
  try {
    const { guideId } = req.params;

    if (guideId !== req.user?._id?.toString() && req.user?.role !== "admin") {
      return res.status(403).json({ error: "You do not have access to these requests" });
    }

    const requests = await Request.find({ guideId }).populate('customerId', 'name email');
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update request status

export const updateRequestStatus = async (req, res) => {
  try {
    (req.body);
    const { id } = req.params;
    const { status } = req.body;

    const existingRequest = await Request.findById(id);
    if (!existingRequest) return res.status(404).json({ message: "Request not found" });

    if (
      existingRequest.guideId?.toString() !== req.user?._id?.toString() &&
      req.user?.role !== "admin"
    ) {
      return res.status(403).json({ message: "You do not have access to this request" });
    }

    // Update the request status
    const updatedRequest = await Request.findByIdAndUpdate(id, { status }, { new: true });

    // If the request is accepted, start a chat conversation
    if (status === "accepted") {
      try {
        await findOrCreateConversation(
          updatedRequest.customerId.toString(),
          updatedRequest.guideId.toString()
        );
      } catch (chatError) {
        console.error("Error starting chat:", chatError.message);
      }
    }

    res.status(200).json(updatedRequest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};