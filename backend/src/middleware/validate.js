// backend/src/middleware/validate.js

const { validationResult } = require('express-validator');
const { AppError } = require('./error');
const logger = require('../config/logger');
const { check } = require('express-validator');

/**
 * Middleware to validate request data based on specified rules
 * @param {Array} validations - Array of express-validator validation chains
 */
const validate = (validations) => {
  return async (req, res, next) => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));

    // Check for validation errors
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    // Log validation errors
    logger.warn(`Validation error in request: ${JSON.stringify(errors.array())}`);

    // Format errors for response
    const extractedErrors = errors.array().map(err => ({ [err.param]: err.msg }));

    // Throw custom error with validation details
    return next(new AppError('Validation failed', 422, extractedErrors));
  };
};

/**
 * Sanitize request data
 * @param {Object} data - Object containing request data
 * @returns {Object} Sanitized data
 */
const sanitize = (data) => {
  const sanitized = {};
  for (let key in data) {
    if (data.hasOwnProperty(key)) {
      // Convert strings to their actual types if possible
      if (typeof data[key] === 'string') {
        if (data[key].toLowerCase() === 'true') {
          sanitized[key] = true;
        } else if (data[key].toLowerCase() === 'false') {
          sanitized[key] = false;
        } else if (!isNaN(data[key])) {
          sanitized[key] = +data[key];
        } else {
          // Trim strings and remove any HTML tags
          sanitized[key] = data[key].trim().replace(/<[^>]*>?/gm, '');
        }
      } else if (Array.isArray(data[key])) {
        // Recursively sanitize array elements
        sanitized[key] = data[key].map(item => sanitize(item));
      } else if (typeof data[key] === 'object' && data[key] !== null) {
        // Recursively sanitize nested objects
        sanitized[key] = sanitize(data[key]);
      } else {
        sanitized[key] = data[key];
      }
    }
  }
  return sanitized;
};

/**
 * Middleware to sanitize request data
 */
const sanitizeRequest = (req, res, next) => {
  req.body = sanitize(req.body);
  req.params = sanitize(req.params);
  req.query = sanitize(req.query);
  next();
};

/**
 * Custom validation rules
 */
const customRules = {
  isValidObjectId: (value) => {
    const objectIdPattern = /^[0-9a-fA-F]{24}$/;
    return objectIdPattern.test(value);
  },
  isValidDateString: (value) => {
    return !isNaN(Date.parse(value));
  },
  // Add more custom validation rules as needed
};

exports.updateUserRules = [
  check('username')
    .optional()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters'),
  check('email')
    .optional()
    .isEmail()
    .withMessage('Please include a valid email'),
  // Add any other fields that are allowed to be updated
];

module.exports = exports;

module.exports = {
  validate,
  sanitizeRequest,
  sanitize,
  customRules
};