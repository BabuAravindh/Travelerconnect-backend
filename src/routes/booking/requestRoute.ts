import express from "express";
import { createRequest, getRequestsForGuide, updateRequestStatus } from "../../controllers/RequestController.js";
import authenticateUser from "../../middleware/authMiddleware.js";

const router = express.Router();

// Create a new request
router.post("/", authenticateUser, createRequest);

// Fetch requests for a guide
router.get("/:guideId", authenticateUser, getRequestsForGuide);

// Update request status
router.put("/:id/status", authenticateUser, updateRequestStatus);

export default router;
