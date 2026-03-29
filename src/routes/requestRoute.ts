import express from "express";
import { createRequest, getRequestsForGuide, updateRequestStatus } from "../controllers/RequestController.js";

const router = express.Router();

// Create a new request
router.post("/", createRequest);

// Fetch requests for a guide
router.get("/:guideId", getRequestsForGuide);

// Update request status
router.put("/:id/status", updateRequestStatus);

export default router;
