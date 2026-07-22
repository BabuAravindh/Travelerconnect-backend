import express from 'express';
import {
  getLanguages,
  createLanguage,
  updateLanguage,
  deleteLanguage,
  getGuideLanguages,
  createGuideLanguage,
  updateGuideLanguage,
  deleteGuideLanguage,
  getStates,
  createState,
  updateState,
  deleteState,
  getCountries,
  createCountry,
  updateCountry,
  deleteCountry,
  getCities,
  createCity,
  updateCity,
  deleteCity,
  getQuestions,
  getQuestionsByCity,
  createQuestion,
  updateQuestion,
  deleteQuestion,
} from '../../controllers/prefinedController.js';

const router = express.Router();

// Language Routes
router.get('/languages', getLanguages);
router.post('/languages', createLanguage);
router.put('/languages/:id', updateLanguage);
router.delete('/languages/:id', deleteLanguage);

// Guide Language Routes
router.get('/guideLanguages', getGuideLanguages);
router.post('/guideLanguages', createGuideLanguage);
router.put('/guideLanguages/:id', updateGuideLanguage);
router.delete('/guideLanguages/:id', deleteGuideLanguage);

// State Routes
router.get('/states', getStates);
router.post('/states', createState);
router.put('/states/:id', updateState);
router.delete('/states/:id', deleteState);

// Country Routes
router.get('/countries', getCountries);
router.post('/countries', createCountry);
router.put('/countries/:id', updateCountry);
router.delete('/countries/:id', deleteCountry);

// City Routes
router.get('/cities', getCities);
router.post('/cities', createCity);
router.put('/cities/:id', updateCity);
router.delete('/cities/:id', deleteCity);

// Question Routes
router.get('/questions', getQuestions);
router.get('/questions/city/:cityId', getQuestionsByCity);
router.post('/questions', createQuestion);
router.put('/questions/:id', updateQuestion);
router.delete('/questions/:id', deleteQuestion);

export default router;