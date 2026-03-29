import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  
  message: { type: String, required: true },
  messageType: { type: String, default: "text" },
  status: { type: String, default: "sent" },
  timestamp: { type: Date, default: Date.now,required:true},
});

export default mongoose.model("Message", messageSchema);
