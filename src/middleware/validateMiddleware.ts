import { body, validationResult } from 'express-validator';

export const validateAiIntegration = [
  body('userId').isMongoId().withMessage('Invalid userId'),
  body('query').trim().notEmpty().withMessage('Query is required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  },
];

export const validateCityInsights = [
  body('userId').isMongoId().withMessage('Invalid userId'),
  body('city').trim().notEmpty().withMessage('City is required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  },
];

export const validateCreditHistory = [
  body('userId').isMongoId().withMessage('Invalid userId'),
  body('creditBefore').isInt({ min: 0 }).withMessage('creditBefore must be a non-negative integer'),
  body('creditsUsed').isInt().withMessage('creditsUsed must be an integer'),
  body('creditsAfter').isInt({ min: 0 }).withMessage('creditsAfter must be a non-negative integer'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  },
];

export const validateCreditRequest = [
  body('userId').isMongoId().withMessage('Invalid userId'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  },
];