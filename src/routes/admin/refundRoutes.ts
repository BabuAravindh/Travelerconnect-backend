import express from "express";
import multer from "multer";
import {
  createRefundRequest,
  fetchAllRefunds,
  updateRefundProof,
} from "../../controllers//refundController.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.route("/").get(fetchAllRefunds).post(createRefundRequest);
router.patch("/proof/:id", upload.single("proof"), updateRefundProof);

export default router;