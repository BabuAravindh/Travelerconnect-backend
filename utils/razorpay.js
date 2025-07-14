import crypto from "crypto";

const webhookSecret = "mysecurewebhooksecret"; // Replace with your actual webhook secret

const webhookBody = JSON.stringify({
  "payload": {
    "payment": {
      "entity": {
        "order_id": "order_QAX6PBlyKCHW0v",  // Use your generated order ID
        "id": "pay_9876543210abcdef",  // Fake payment ID for testing
        "status": "captured"
      }
    }
  }
});

// 🔹 Generate Signature
const generatedSignature = crypto
  .createHmac("sha256", webhookSecret)
  .update(webhookBody)
  .digest("hex");

console.log("Generated Signature:", generatedSignature);
