import mongoose from "mongoose";
import User from "../models/User.js"; // Your User model
import { 
  AiIntegration, 
  CreditHistory 
} from "../models/aiModel.js"; 

// import Attraction from "../models/Attractions.js";
import Booking from "../models/bookingModel.js";
import Conversation from "../models/Conversation.js";
import Feedback from "../models/feedbackModel.js";
import Guide from "../models/Guide.js";
import Message from "../models/Message.js";
import { ModeOfPayment, Payment, Refund } from "../models/payment.js";
import Request from "../models/RequestModel.js";
import ResetPassword from "../models/ResetPassword.js";
import Route from "../models/routeSchema.js";
import UserProfile from "../models/UserProfile.js";

const deleteUser = async (userId) => {
    const session = await mongoose.startSession();
    session.startTransaction();
  
    try {
      // 🛑 Step 1: Delete User Profile
      await UserProfile.deleteOne({ userId }).session(session);
  
      // 🛑 Step 2: Delete AI Data
      await AiIntegration.deleteMany({ userId }).session(session);
      await CreditHistory.deleteMany({ userId }).session(session);
  
      // 🛑 Step 4: Delete Bookings where User is a Customer or Guide
      await Booking.deleteMany({
        $or: [{ userId }, { guideId: userId }]
      }).session(session);
  
      // 🛑 Step 5: Delete Conversations & Messages
      const conversations = await Conversation.find({ participants: userId }).session(session);
      const conversationIds = conversations.map(c => c._id);
      await Message.deleteMany({ conversationId: { $in: conversationIds } }).session(session);
      await Conversation.deleteMany({ participants: userId }).session(session);
  
      // 🛑 Step 6: Delete Feedback where User is Customer or Guide
      await Feedback.deleteMany({
        $or: [{ userId }, { guideId: userId }]
      }).session(session);
  
      // 🛑 Step 7: Delete Guide Profile (If Guide)
      await Guide.deleteOne({ userId }).session(session);
  
      // 🛑 Step 8: Delete Payments & Refunds Linked to User's Bookings
      const payments = await Payment.find({ bookingId: { $in: conversationIds } }).session(session);
      const paymentIds = payments.map(p => p._id);
      await Refund.deleteMany({ paymentId: { $in: paymentIds } }).session(session);
      await Payment.deleteMany({ bookingId: { $in: conversationIds } }).session(session);
      await ModeOfPayment.deleteMany({ bookingId: { $in: conversationIds } }).session(session);
  
      // 🛑 Step 9: Delete Requests (Guide/User Requests)
      await Request.deleteMany({ 
        $or: [{ customerId: userId }, { guideId: userId }] 
      }).session(session);
  
      // 🛑 Step 10: Delete Password Reset Requests
      await ResetPassword.deleteMany({ userId }).session(session);
  
      // 🛑 Step 11: Delete Routes Created by Guide
      await Route.deleteMany({ guideId: userId }).session(session);
  
      // 🛑 Step 12: Finally, Delete the User
      await User.deleteOne({ _id: userId }).session(session);
  
      // ✅ Commit Transaction if Everything is Successful
      await session.commitTransaction();
      session.endSession();
  
      return { success: true, message: "User and related data deleted successfully" };
    } catch (error) {
      // ❌ Rollback Transaction on Error
      await session.abortTransaction();
      session.endSession();
      return { success: false, message: "Error deleting user", error };
    }
  };


  export default deleteUser;