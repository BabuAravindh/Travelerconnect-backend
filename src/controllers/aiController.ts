import Aichat from '../models/AiChatModel.js';
import { CreditHistory, CreditRequest } from '../models/aiModel.js';
import User from '../models/User.js';
import OpenAI from 'openai';
import mongoose from 'mongoose';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper: Get latest user credits
const getUserCredits = async (userId) => {
  try {
    const latestCredit = await CreditHistory.findOne({ userId }).sort({ createdAt: -1 });
    return latestCredit ? latestCredit.creditsAfter : 0;
  } catch (error) {
    console.error('Error fetching user credits:', error);
    throw new Error('Unable to fetch user credits');
  }
};

// Helper: Deduct credits with transaction
const deductCredits = async (userId, amount, interactionId = null, session) => {
  try {
    const latestCredit = await CreditHistory.findOne({ userId }).sort({ createdAt: -1 });
    const creditBefore = latestCredit ? latestCredit.creditsAfter : 0;
    const creditsAfter = creditBefore - amount;

    if (creditsAfter < 0) throw new Error('Insufficient credits');

    await CreditHistory.create(
      [{ userId, creditBefore, creditsUsed: amount, creditsAfter, interactionId }],
      { session }
    );

    return creditsAfter;
  } catch (error) {
    console.error('Error deducting credits:', error);
    throw error;
  }
};

// Validate user existence
const validateUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');
  return user;
};

// Get City Insights
export const getCityInsights = async (req, res) => {
  const { userId, city } = req.body;

  if (!userId || !city) {
    return res.status(400).json({ success: false, error: 'userId and city are required' });
  }

  const query = `Provide detailed travel insights for ${city} including:
- Top 3 attractions with brief descriptions
- Best local cuisine to try
- Cultural tips and etiquette
- Ideal visit duration
- Any seasonal considerations
Format the response in Markdown with clear section headings.`;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await validateUser(userId);
    const userCredits = await getUserCredits(userId);
    if (userCredits < 1) {
      return res.status(402).json({
        success: false,
        error: 'Insufficient credits',
        message: 'You need at least 1 credit to get city insights',
      });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: query }],
      temperature: 0.7,
    });

    const responseText = completion.choices[0].message.content;

    const newChat = await Aichat.create(
      [{ userId, query: `City insights for ${city}`, response: responseText, responseStatus: 'success' }],
      { session }
    );

    const remainingCredits = await deductCredits(userId, 1, newChat[0]._id, session);

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      data: {
        city,
        insights: responseText,
        remainingCredits,
        timestamp: new Date(),
        interactionId: newChat[0]._id,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error in getCityInsights:', error);
    if (error.message === 'Insufficient credits') {
      return res.status(402).json({
        success: false,
        error: error.message,
        message: 'You need at least 1 credit to get city insights',
      });
    }
    res.status(error.message === 'User not found' ? 404 : 500).json({
      success: false,
      error: error.message || 'Error generating insights',
    });
  } finally {
    session.endSession();
  }
};

// Save AI Integration
export const saveAiIntegration = async (req, res) => {
  const { userId, query } = req.body;

  if (!userId || !query) {
    return res.status(400).json({ success: false, error: 'userId and query are required' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await validateUser(userId);
    const userCredits = await getUserCredits(userId);
    if (userCredits < 1) {
      return res.status(402).json({
        success: false,
        error: 'Insufficient credits',
        message: 'You need at least 1 credit to process this query',
      });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: query }],
      temperature: 0.7,
    });

    const responseText = completion.choices[0].message.content;

    const newChat = await Aichat.create(
      [{ userId, query, response: responseText, responseStatus: 'success' }],
      { session }
    );

    const remainingCredits = await deductCredits(userId, 1, newChat[0]._id, session);

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      data: {
        interactionId: newChat[0]._id,
        query,
        response: responseText,
        responseStatus: 'success',
        remainingCredits,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error in saveAiIntegration:', error);
    let responseStatus = error.response ? 'error' : 'timeout';
    let responseText = error.message || 'Timeout error';

    try {
      const newChat = await Aichat.create(
        [{ userId, query, response: responseText, responseStatus }],
        { session }
      );

      await session.commitTransaction();

      res.status(201).json({
        success: false,
        data: {
          interactionId: newChat[0]._id,
          query,
          response: responseText,
          responseStatus,
          remainingCredits: await getUserCredits(userId),
          timestamp: new Date(),
        },
      });
    } catch (dbError) {
      res.status(500).json({
        success: false,
        error: 'Error saving AI chat',
        message: dbError.message,
      });
    }
  } finally {
    session.endSession();
  }
};

// Get AI Chat Responses by User ID
export const getAichatResponsesByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    await validateUser(userId);

    const aiResponses = await Aichat.find({ userId })
      .populate('userId', 'name email')
      .sort({ createdAt: 1 });

    if (!aiResponses || aiResponses.length === 0) {
       return res.status(404).json({
        success: false,
        data: null,
        error: "No AI chat responses found for this user.",
      });

    }

    res.status(200).json({
      success: true,
      data: {
        responses: aiResponses,
      },
    });
  } catch (error) {
    console.error("Error fetching AI chat responses:", error);
    res.status(error.message === 'User not found' ? 404 : 500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
};

// Admin: Get All AI Interactions
export const getAllAiInteractions = async (req, res) => {
  try {
    const interactions = await Aichat.find()
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        interactions,
      },
    });
  } catch (error) {
    console.error('Error fetching AI interactions:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
};

// Admin: Get All Credit Records
export const getAllCreditRecords = async (req, res) => {
  try {
    const records = await CreditHistory.find()
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        records,
      },
    });
  } catch (error) {
    console.error('Error fetching credit records:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
};

// Admin: Get All Credit Requests
export const getAllCreditRequests = async (req, res) => {
  try {
    const requests = await CreditRequest.find()
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        requests,
      },
    });
  } catch (error) {
    console.error('Error fetching credit requests:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
};

// Save Credit History
export const saveCreditHistory = async (req, res) => {
  try {
    const { userId, creditBefore, creditsUsed, creditsAfter } = req.body;

    if (!userId || creditBefore === undefined || creditsUsed === undefined || creditsAfter === undefined) {
      return res.status(400).json({ success: false, error: "All fields are required" });
    }

    if (creditsAfter < 0) {
      return res.status(400).json({ success: false, error: "creditsAfter cannot be negative" });
    }

    await validateUser(userId);

    const newHistory = await CreditHistory.create(req.body);
    res.status(201).json({
      success: true,
      data: newHistory,
    });
  } catch (error) {
    res.status(error.message === 'User not found' ? 404 : 500).json({
      success: false,
      error: error.message || 'Error saving Credit History',
    });
  }
};

// Get Credit History
export const getCreditHistory = async (req, res) => {
  try {
    const { userId } = req.params;

    await validateUser(userId);

    const history = await CreditHistory.find({ userId })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        history,
      },
    });
  } catch (error) {
    res.status(error.message === 'User not found' ? 404 : 500).json({
      success: false,
      error: error.message || 'Error fetching Credit History',
    });
  }
};

// User: Request credits
export const requestAiCredits = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: "User ID is required" });
    }

    await validateUser(userId);

    const existingRequest = await CreditRequest.findOne({ userId, status: 'pending' });
    if (existingRequest) {
      return res.status(400).json({
        success: false,
        error: "You already have a pending credit request. Please wait for approval.",
      });
    }

    const latestCredit = await CreditHistory.findOne({ userId }).sort({ createdAt: -1 });
    const userCredits = latestCredit ? latestCredit.creditsAfter : 0;

    if (userCredits > 10) {
      return res.status(400).json({
        success: false,
        error: "You already have enough credits. Cannot request more at this time.",
      });
    }

    const newRequest = await CreditRequest.create({ userId });

    res.status(201).json({
      success: true,
      data: {
        message: 'Credit request submitted successfully.',
        request: newRequest,
      },
    });
  } catch (error) {
    res.status(error.message === 'User not found' ? 404 : 500).json({
      success: false,
      error: error.message || 'Error submitting credit request',
    });
  }
};

// Admin: Approve credit request
export const approveCreditRequest = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { requestId } = req.params;

    const creditRequest = await CreditRequest.findById(requestId);
    if (!creditRequest) {
      return res.status(404).json({ success: false, error: "Credit request not found" });
    }

    if (creditRequest.status !== 'pending') {
      return res.status(400).json({ success: false, error: "Request already processed" });
    }

    const userId = creditRequest.userId;
    await validateUser(userId);

    const latestCredit = await CreditHistory.findOne({ userId }).sort({ createdAt: -1 });
    const creditBefore = latestCredit ? latestCredit.creditsAfter : 0;
    const creditsAfter = creditBefore + 10;

    await CreditHistory.create(
      [{
        userId,
        creditBefore,
        creditsUsed: -10,
        creditsAfter,
        interactionId: null,
      }],
      { session }
    );

    creditRequest.status = 'approved';
    await creditRequest.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      data: {
        message: "Credit request approved, 10 credits added.",
      },
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(error.message === 'User not found' ? 404 : 500).json({
      success: false,
      error: error.message || 'Error approving credit request',
    });
  } finally {
    session.endSession();
  }
};


export const getCurrentCredit = async (req, res) => {
  const { userId } = req.params;

  // Security: Only allow access to self or admin
  if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  try {
    const latestRecord = await CreditHistory.findOne({ userId })
      .sort({ createdAt: -1 });

    if (!latestRecord) {
      return res.status(404).json({
        success: false,
        message: 'No credit history found for this user.',
      });
    }

    return res.status(200).json({
      success: true,
      currentCredits: latestRecord.creditsAfter,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching current credits.',
      error: err.message,
    });
  }
};
