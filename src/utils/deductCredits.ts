import mongoose from 'mongoose';
import {  CreditHistory, AiIntegration } from '../models/aiModel.js'; // Adjust path
import UserModel from '../models/User.js'; // Adjust path, use alias to avoid conflict

const CREDITS_PER_AI_REQUEST = 1; // Define cost per AI request

export const deductCredits = async (userId, query, response = {}) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Find user within transaction
    const user = await UserModel.findById(userId).session(session);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user has enough credits
    if (user.credits < CREDITS_PER_AI_REQUEST) {
      throw new Error('Insufficient credits');
    }

    // Create AI interaction record
    const aiIntegration = new AiIntegration({
      userId,
      query,
      response: JSON.stringify(response),
      responseStatus: response.error ? 'error' : 'success',
    });
    await aiIntegration.save({ session });

    // Deduct credits
    const creditBefore = user.credits;
    user.credits -= CREDITS_PER_AI_REQUEST;
    const creditAfter = user.credits; // Ensure creditAfter is defined
    await user.save({ session });

    // Log credit history
    const creditHistory = new CreditHistory({
      userId,
      creditBefore,
      creditsUsed: CREDITS_PER_AI_REQUEST,
      creditsAfter: creditAfter, // Use correct variable
      interactionId: aiIntegration._id,
    });
    await creditHistory.save({ session });

    await session.commitTransaction();
    return { success: true, aiIntegrationId: aiIntegration._id };
  } catch (error) {
    await session.abortTransaction();
    // Log error in AiIntegration if query is provided
    if (query) {
      await new AiIntegration({
        userId,
        query,
        response: JSON.stringify({ error: error.message }),
        responseStatus: 'error',
      }).save();
    }
    throw error;
  } finally {
    session.endSession();
  }
};