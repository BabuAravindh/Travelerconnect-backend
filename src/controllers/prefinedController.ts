import { Language, Country, City, State, GuideLanguage, Question } from '../models/predefineSchemas.js';

// 🌐 LANGUAGES
export const getLanguages = async (req, res) => {
  try {
    const languages = await Language.find();
    res.status(200).json(languages);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching languages', error: error.message });
  }
};

export const createLanguage = async (req, res) => {
  try {
    const language = await Language.create(req.body);
    res.status(201).json(language);
  } catch (error) {
    res.status(400).json({ message: 'Error creating language', error: error.message });
  }
};

export const updateLanguage = async (req, res) => {
  try {
    const updatedLanguage = await Language.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedLanguage) {
      return res.status(404).json({ message: 'Language not found' });
    }
    res.status(200).json(updatedLanguage);
  } catch (error) {
    res.status(400).json({ message: 'Error updating language', error: error.message });
  }
};

export const deleteLanguage = async (req, res) => {
  try {
    const deletedLanguage = await Language.findByIdAndDelete(req.params.id);
    if (!deletedLanguage) {
      return res.status(404).json({ message: 'Language not found' });
    }
    res.status(200).json({ message: 'Language deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: 'Error deleting language', error: error.message });
  }
};

// 🌐 GUIDE LANGUAGES
export const getGuideLanguages = async (req, res) => {
  try {
    const guideLanguages = await GuideLanguage.find().populate('userId');
    res.status(200).json(guideLanguages);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching guide languages', error: error.message });
  }
};

export const createGuideLanguage = async (req, res) => {
  try {
    const guideLanguage = await GuideLanguage.create(req.body);
    res.status(201).json(guideLanguage);
  } catch (error) {
    res.status(400).json({ message: 'Error creating guide language', error: error.message });
  }
};

export const updateGuideLanguage = async (req, res) => {
  try {
    const updatedGuideLanguage = await GuideLanguage.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedGuideLanguage) {
      return res.status(404).json({ message: 'Guide language not found' });
    }
    res.status(200).json(updatedGuideLanguage);
  } catch (error) {
    res.status(400).json({ message: 'Error updating guide language', error: error.message });
  }
};

export const deleteGuideLanguage = async (req, res) => {
  try {
    const deletedGuideLanguage = await GuideLanguage.findByIdAndDelete(req.params.id);
    if (!deletedGuideLanguage) {
      return res.status(404).json({ message: 'Guide language not found' });
    }
    res.status(200).json({ message: 'Guide language deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: 'Error deleting guide language', error: error.message });
  }
};

// 🌐 STATES
export const getStates = async (req, res) => {
  try {
    const states = await State.find();
    res.status(200).json(states);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching states', error: error.message });
  }
};

export const createState = async (req, res) => {
  try {
    const state = await State.create(req.body);
    res.status(201).json(state);
  } catch (error) {
    res.status(400).json({ message: 'Error creating state', error: error.message });
  }
};

export const updateState = async (req, res) => {
  try {
    const updatedState = await State.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedState) {
      return res.status(404).json({ message: 'State not found' });
    }
    res.status(200).json(updatedState);
  } catch (error) {
    res.status(400).json({ message: 'Error updating state', error: error.message });
  }
};

export const deleteState = async (req, res) => {
  try {
    const deletedState = await State.findByIdAndDelete(req.params.id);
    if (!deletedState) {
      return res.status(404).json({ message: 'State not found' });
    }
    res.status(200).json({ message: 'State deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: 'Error deleting state', error: error.message });
  }
};

// 🌐 COUNTRIES
export const getCountries = async (req, res) => {
  try {
    const countries = await Country.find();
    res.status(200).json(countries);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching countries', error: error.message });
  }
};

export const createCountry = async (req, res) => {
  try {
    const country = await Country.create(req.body);
    res.status(201).json(country);
  } catch (error) {
    res.status(400).json({ message: 'Error creating country', error: error.message });
  }
};

export const updateCountry = async (req, res) => {
  try {
    const updatedCountry = await Country.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedCountry) {
      return res.status(404).json({ message: 'Country not found' });
    }
    res.status(200).json(updatedCountry);
  } catch (error) {
    res.status(400).json({ message: 'Error updating country', error: error.message });
  }
};

export const deleteCountry = async (req, res) => {
  try {
    const deletedCountry = await Country.findByIdAndDelete(req.params.id);
    if (!deletedCountry) {
      return res.status(404).json({ message: 'Country not found' });
    }
    res.status(200).json({ message: 'Country deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: 'Error deleting country', error: error.message });
  }
};

// 🌐 CITIES
export const getCities = async (req, res) => {
  try {
    const cities = await City.find().sort({ order: 1 });
    res.status(200).json({ success: true, data: cities });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching cities", error: error.message });
  }
};

export const createCity = async (req, res) => {
  try {
    const { cityName, order } = req.body;
    if (!cityName) {
      return res.status(400).json({ success: false, message: "City name is required" });
    }
    const existingCity = await City.findOne({ cityName });
    if (existingCity) {
      return res.status(400).json({ success: false, message: "City already exists" });
    }
    const city = await City.create({ cityName, order });
    res.status(201).json({ success: true, data: city });
  } catch (error) {
    res.status(400).json({ success: false, message: "Error creating city", error: error.message });
  }
};

export const updateCity = async (req, res) => {
  try {
    const { cityName, order } = req.body;
    const updatedCity = await City.findByIdAndUpdate(
      req.params.id,
      { cityName, order },
      { new: true, runValidators: true }
    );
    if (!updatedCity) {
      return res.status(404).json({ success: false, message: "City not found" });
    }
    res.status(200).json({ success: true, data: updatedCity });
  } catch (error) {
    res.status(400).json({ success: false, message: "Error updating city", error: error.message });
  }
};

export const deleteCity = async (req, res) => {
  try {
    const deletedCity = await City.findByIdAndDelete(req.params.id);
    if (!deletedCity) {
      return res.status(404).json({ success: false, message: "City not found" });
    }
    res.status(200).json({ success: true, message: "City deleted successfully" });
  } catch (error) {
    res.status(400).json({ success: false, message: "Error deleting city", error: error.message });
  }
};

// 🌐 QUESTIONS
export const getQuestions = async (req, res) => {
  try {
    const questions = await Question.find()
      .populate('cityId', 'cityName') // Populate cityName for specific questions
      .sort({ order: 1 });
    res.status(200).json({ success: true, data: questions });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching questions", error: error.message });
  }
};

export const getQuestionsByCity = async (req, res) => {
  try {
    const { cityId } = req.params;
    // Validate cityId exists
    const city = await City.findById(cityId);
    if (!city) {
      return res.status(404).json({ success: false, message: "City not found" });
    }
    // Fetch common questions (no cityId) and specific questions for the city
    const questions = await Question.find({
      $or: [
        { cityId: cityId, type: "specific" },
        { type: "common", cityId: null }, // Common questions have no cityId
      ],
    })
      .populate('cityId', 'cityName')
      .sort({ order: 1 });
    if (!questions.length) {
      return res.status(404).json({ success: false, message: "No questions found for this city" });
    }
    res.status(200).json({ success: true, data: questions });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching questions for city", error: error.message });
  }
};

export const createQuestion = async (req, res) => {
  try {
    const { questionText, cityId, status, order, type, options } = req.body;
     ({ questionText, cityId, status, order, type, options } )
    // Validate required fields
    if (!questionText || !type || !order) {
      return res.status(400).json({ success: false, message: "Question text, type, and order are required" });
    }
    if (!["specific", "common"].includes(type)) {
      return res.status(400).json({ success: false, message: "Type must be 'specific' or 'common'" });
    }

    // Type-specific validation
    if (type === "specific") {
      if (!cityId) {
        return res.status(400).json({ success: false, message: "City ID is required for specific questions" });
      }
      // Validate city exists
      const city = await City.findById(cityId);
      if (!city) {
        return res.status(404).json({ success: false, message: "City not found" });
      }
      if (options && options.length > 0) {
        return res.status(400).json({ success: false, message: "Options are not allowed for specific questions" });
      }
    } else if (type === "common") {
      if (cityId) {
        return res.status(400).json({ success: false, message: "City ID must not be provided for common questions" });
      }
      if (!options || !Array.isArray(options) || options.length === 0) {
        return res.status(400).json({ success: false, message: "Options must be a non-empty array for common questions" });
      }
    }

    // Create question
    const question = await Question.create({
      questionText,
      cityId: type === "specific" ? cityId : null, // Set cityId to null for common questions
      status,
      order,
      type,
      options: type === "common" ? options : [],
    });

    res.status(201).json({ success: true, data: question });
  } catch (error) {
    if (error.message.includes("Cannot add more than 10 specific questions")) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.code === 11000 && error.message.includes("cityId_1_order_1_type_1")) {
      return res.status(400).json({
        success: false,
        message: `A ${req.body.type} question with order ${req.body.order} already exists for this ${req.body.type === "specific" ? "city" : "common question set"}`,
      });
    }
    res.status(400).json({ success: false, message: "Error creating question", error: error.message });
  }
};

export const updateQuestion = async (req, res) => {
  try {
    const { questionText, cityId, status, order, type, options } = req.body;
    ("Request Body:", { questionText, cityId, status, order, type, options });

    if (type && !["specific", "common"].includes(type)) {
      ("❌ Invalid type provided:", type);
      return res.status(400).json({ success: false, message: "Type must be 'specific' or 'common'" });
    }

    const existingQuestion = await Question.findById(req.params.id);
    if (!existingQuestion) {
      ("❌ Question not found with ID:", req.params.id);
      return res.status(404).json({ success: false, message: "Question not found" });
    }
    ("✅ Found existing question:", existingQuestion);

    const questionType = type || existingQuestion.type;
    ("Question Type to use:", questionType);

    if (questionType === "specific") {
      if (cityId === null || cityId === "") {
        ("❌ City ID missing for specific question");
        return res.status(400).json({ success: false, message: "City ID is required for specific questions" });
      }
      if (cityId) {
        const city = await City.findById(cityId);
        if (!city) {
          ("❌ City not found with ID:", cityId);
          return res.status(404).json({ success: false, message: "City not found" });
        }
        ("✅ Valid city found:", city);
      }
      if (options && options.length > 0) {
        ("❌ Options provided for specific question:", options);
        return res.status(400).json({ success: false, message: "Options are not allowed for specific questions" });
      }
    } else if (questionType === "common") {
      if (cityId) {
        ("❌ City ID provided for common question:", cityId);
        return res.status(400).json({ success: false, message: "City ID must not be provided for common questions" });
      }
      if (!Array.isArray(options) || options.length === 0) {
        ("❌ Invalid options for common question:", options);
        return res.status(400).json({ success: false, message: "Options must be a non-empty array for common questions" });
      }
    }

    const updatePayload = {
      questionText,
      cityId: questionType === "specific" ? cityId || existingQuestion.cityId : null,
      status,
      order,
      type: questionType,
      options: questionType === "common" ? options || existingQuestion.options : [],
    };

    ("🔄 Updating question with payload:", updatePayload);

    const updatedQuestion = await Question.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { new: true, runValidators: true }
    );

    if (!updatedQuestion) {
      ("❌ Failed to update question - not found after update attempt");
      return res.status(404).json({ success: false, message: "Question not found" });
    }

    ("✅ Question updated successfully:", updatedQuestion);
    res.status(200).json({ success: true, data: updatedQuestion });
  } catch (error) {
    console.error("❌ Error occurred during update:", error);
    if (error.code === 11000 && error.message.includes("cityId_1_order_1_type_1")) {
      return res.status(400).json({
        success: false,
        message: `A ${req.body.type || existingQuestion.type} question with order ${req.body.order} already exists for this ${req.body.type === "specific" ? "city" : "common question set"}`,
      });
    }
    res.status(400).json({ success: false, message: "Error updating question", error: error.message });
  }
};


export const deleteQuestion = async (req, res) => {
  try {
    const deletedQuestion = await Question.findByIdAndDelete(req.params.id);
    if (!deletedQuestion) {
      return res.status(404).json({ success: false, message: "Question not found" });
    }
    res.status(200).json({ success: true, message: "Question deleted successfully" });
  } catch (error) {
    res.status(400).json({ success: false, message: "Error deleting question", error: error.message });
  }
};