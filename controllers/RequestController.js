// controllers/requestController.js
import Request from '../models/RequestModel.js';
import axios from 'axios';
// Create a new request
export const createRequest = async (req, res) => {
  try {
    const { customerId, guideId, paymentStatus } = req.body;

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
    const requests = await Request.find({ guideId }).populate('customerId', 'name email');
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update request status

export const updateRequestStatus = async (req, res) => {
  try {
    console.log(req.body);
    const { id } = req.params;
    const { status } = req.body;

    // Update the request status
    const updatedRequest = await Request.findByIdAndUpdate(id, { status }, { new: true });
    if (!updatedRequest) return res.status(404).json({ message: "Request not found" });

    // If the request is accepted, start a chat conversation
    if (status === "accepted") {
      try {
        await axios.post("http://localhost:5000/api/chats/startConversation", {
          senderId: updatedRequest.customerId, 
          receiverId: updatedRequest.guideId
        });
      } catch (chatError) {
        console.error("Error starting chat:", chatError.message);
      }
    }

    res.status(200).json(updatedRequest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};