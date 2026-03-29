import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import User from '../../models/User.js';
import { Question } from '../../models/predefineSchemas.js';
import { generateAIContent, fetchCityCoordinates } from '../../services/aiService.js';
import { deductCredits } from '../../utils/deductCredits.js'; // Import deductCredits from util

// In-memory store for travel plans (replace with DB later)
const travelPlans = new Map();

// JWT authentication middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error("JWT verification error:", error);
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

const generatePlanId = () => {
  return new mongoose.Types.ObjectId().toString(); // Using MongoDB ObjectId for simplicity
};

// Static itinerary generator - Modified to handle optional preferences
const generateStaticItinerary = async (cityName, questions, answers) => {
  ('Generating itinerary for:', { cityName, questions, answers });

  // Validate required fields
  if (!cityName || typeof cityName !== 'string') {
    throw new Error('cityName must be a non-empty string');
  }

  if (!Array.isArray(questions) || !Array.isArray(answers)) {
    throw new Error('questions and answers must be arrays');
  }

  if (questions.length !== answers.length) {
    throw new Error('questions and answers arrays must be of equal length');
  }

  // Format questions and answers for the prompt
  const qaText = questions.map((q, i) => 
    `Q: ${q.questionText}\nA: ${answers[i]?.response || 'Not provided'}`
  ).join('\n\n');

  // Updated prompt for Mumbai with flexible preferences
  const itineraryPrompt = `Act as an expert travel planner for ${cityName}. Create a detailed itinerary based on the following preferences:

Key Preferences:
${qaText}

Include:
1. Hotel recommendations suitable for the group size
2. Daily activities (morning/afternoon/evening)
3. Dining options with cuisine types
4. Airport transport options (e.g., prepaid taxi, Mumbai Metro, Ola/Uber)
5. Activity-focused suggestions as requested in preferences
6. Avoid repeating activities across days
7. Ensure activities and transport align with the group size and transport preference

Format as plain text without markdown. Structure by days with clear sections.`;

  ('Itinerary Prompt:\n', itineraryPrompt);

  // Generate itinerary using AI service
  const itineraryResult = await generateAIContent(itineraryPrompt, null, {
    model: 'gpt-3.5-turbo',
    maxTokens: 2000,
    temperature: 0.7,
    parseJson: false
  });

  if (!itineraryResult.success || !itineraryResult.content) {
    throw new Error('Failed to generate itinerary');
  }

  return { prompt: itineraryPrompt, content: itineraryResult.content };
};

// Controller: Create a travel plan
export const createTravelPlan = [
  authMiddleware,
  async (req, res) => {
    try {
      const { cityName, questions, answers } = req.body;

      // Basic validation
      if (!cityName || !questions || !answers) {
        return res.status(400).json({
          success: false,
          message: 'cityName, questions, and answers are required'
        });
      }

      // Generate itinerary
      const { prompt, content: itinerary } = await generateStaticItinerary(cityName, questions, answers);

      // Deduct credits for AI usage
      const userId = req.user.id; // Assuming req.user contains decoded JWT with user ID
      const aiResponse = { itinerary }; // Response to log in AiIntegration
      await deductCredits(userId, prompt, aiResponse);

      // Create and store plan
      const planId = generatePlanId();
      const travelPlan = {
        cityName,
        questions,
        answers,
        itinerary,
        createdAt: new Date().toISOString(),
      };
      travelPlans.set(planId, travelPlan);

      return res.status(201).json({
        success: true,
        data: { ...travelPlan, planId },
        message: 'Travel plan created successfully'
      });

    } catch (err) {
      console.error("Error in createTravelPlan:", err);
      return res.status(400).json({
        success: false,
        message: err.message || 'Failed to create travel plan'
      });
    }
  }
];

// Remaining controllers unchanged
export const getTravelPlan = [
  authMiddleware,
  (req, res) => {
    const { id } = req.params;
    const travelPlan = travelPlans.get(id);

    if (!travelPlan) {
      return res.status(404).json({
        success: false,
        message: 'Travel plan not found',
      });
    }

    res.status(200).json({
      success: true,
      data: travelPlan,
    });
  }
];

export const getQuestionsByCity = [
  authMiddleware,
  async (req, res) => {
    try {
      const { cityId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(cityId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid cityId',
        });
      }

      let questions = await Question.find({ 
        cityId, 
        status: 'active' 
      })
        .select('questionText type options order cityId status createdAt updatedAt __v')
        .sort({ order: 1 });
      ('City-specific questions:', questions);

      if (questions.length === 0) {
        questions = await Question.find({ 
          cityId: null, 
          status: 'active' 
        })
          .select('questionText type options order cityId status createdAt updatedAt __v')
          .sort({ order: 1 });
        ('Falling back to common questions:', questions);
      }

      questions = questions.map(q => {
        const question = q.toObject();
        if (question.options && question.options.length > 0 && question.type === 'common') {
          question.type = 'options';
        }
        if (question._id === '682d2d8b307ec471546ae030') {
          question.options = question.options.map(opt => 
            opt === 'evtns' ? 'events' : 
            opt === 'activites' ? 'activities' : 
            opt
          );
        }
        return question;
      });

      res.status(200).json({
        success: true,
        data: questions,
        message: questions.some(q => !q.cityId) 
          ? 'Using common questions as no city-specific questions are available'
          : 'Questions retrieved successfully',
      });
    } catch (err) {
      console.error("Error in getQuestionsByCity:", err);
      res.status(500).json({
        success: false,
        message: err.message || 'Internal Server Error',
      });
    }
  }
];

export const getCommonQuestions = [
  authMiddleware,
  async (req, res) => {
    try {
      const questions = await Question.find({ 
        cityId: null, 
        status: 'active' 
      })
        .select('questionText type options order cityId status createdAt updatedAt __v')
        .sort({ order: 1 });

      const correctedQuestions = questions.map(q => {
        const question = q.toObject();
        if (question.options && question.options.length > 0 && question.type === 'common') {
          question.type = 'options';
        }
        return question;
      });

      res.status(200).json({
        success: true,
        data: correctedQuestions,
        message: 'Common questions retrieved successfully',
      });
    } catch (err) {
      console.error("Error in getCommonQuestions:", err);
      res.status(500).json({
        success: false,
        message: err.message || 'Internal Server Error',
      });
    }
  }
];

export const getCities = [
  authMiddleware,
  async (req, res) => {
    try {
      const City = mongoose.model('City', new mongoose.Schema({
        cityName: { type: String, required: true },
        order: { type: Number, required: true },
        createdAt: { type: Date, default: Date.now },
      }));

      const cities = await City.find().sort({ order: 1 });
      ('Cities retrieved:', cities);
      res.status(200).json({
        success: true,
        data: cities,
        message: 'Cities retrieved successfully',
      });
    } catch (err) {
      console.error("Error in getCities:", err);
      res.status(500).json({
        success: false,
        message: err.message || 'Internal Server Error',
      });
    }
  }
];

export const requestCredits = [
  authMiddleware,
  async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId || userId !== req.user.id) {
        return res.status(400).json({
          success: false,
          message: 'Invalid userId',
        });
      }

      res.status(200).json({
        success: true,
        message: 'Credit request submitted successfully',
      });
    } catch (err) {
      console.error("Error in requestCredits:", err);
      res.status(500).json({
        success: false,
        message: err.message || 'Internal Server Error',
      });
    }
  }
];