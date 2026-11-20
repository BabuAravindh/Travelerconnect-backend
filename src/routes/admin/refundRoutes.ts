import express from "express";
import multer from "multer";
import {
  createRefundRequest,
  fetchAllRefunds,
  updateRefundProof,
} from "../../controllers//refundController.js";
import { verifyAdmin } from "../../middleware/verifyAdmin.js";
import authenticateUser from "../../middleware/authMiddleware.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.get("/", verifyAdmin, fetchAllRefunds);
router.post("/", authenticateUser, createRefundRequest);
router.patch("/proof/:id", verifyAdmin, upload.single("proof"), updateRefundProof);

export default router;