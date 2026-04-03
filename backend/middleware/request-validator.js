const { body, validationResult } = require('express-validator');

/**
 * Validation middleware for tool configuration requests
 */

// Validation rules for tool configuration
const validateToolConfig = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Configuration name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Configuration name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z0-9\s\-_.,!?()]+$/)
    .withMessage('Configuration name contains invalid characters'),

  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),

  body('toolId')
    .isInt({ min: 1 })
    .withMessage('Tool ID must be a positive integer'),

  body('settings')
    .optional()
    .isObject()
    .withMessage('Settings must be an object')
    .custom((value) => {
      try {
        JSON.stringify(value);
        return true;
      } catch {
        throw new Error('Settings contain invalid data');
      }
    }),

  body('tags')
    .optional()
    .isArray({ max: 10 })
    .withMessage('Tags cannot exceed 10 items')
    .custom((tags) => {
      if (!Array.isArray(tags)) return true;
      
      for (const tag of tags) {
        if (typeof tag !== 'string') {
          throw new Error('All tags must be strings');
        }
        if (tag.length === 0) {
          throw new Error('Tags cannot be empty');
        }
        if (tag.length > 30) {
          throw new Error('Each tag cannot exceed 30 characters');
        }
        if (!/^[a-zA-Z0-9\s\-_.,!?()]+$/.test(tag)) {
          throw new Error('Tags contain invalid characters');
        }
      }
      return true;
    }),

  body('isDefault')
    .optional()
    .isBoolean()
    .withMessage('isDefault must be a boolean'),

  body('isShared')
    .optional()
    .isBoolean()
    .withMessage('isShared must be a boolean'),

  body('version')
    .optional()
    .isString()
    .withMessage('Version must be a string'),

  // Custom validation for the entire request
  (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().map(error => ({
          field: error.path,
          message: error.msg,
          value: error.value
        }))
      });
    }

    next();
  }
];

// Validation for import requests
const validateImportRequest = [
  body('configurations')
    .isArray({ min: 1 })
    .withMessage('Configurations must be a non-empty array')
    .custom((configs) => {
      for (const config of configs) {
        if (!config.name || typeof config.name !== 'string') {
          throw new Error('Each configuration must have a valid name');
        }
        if (!config.toolId || !Number.isInteger(config.toolId)) {
          throw new Error('Each configuration must have a valid toolId');
        }
        if (config.tags && !Array.isArray(config.tags)) {
          throw new Error('Tags must be an array');
        }
        if (config.settings && typeof config.settings !== 'object') {
          throw new Error('Settings must be an object');
        }
      }
      return true;
    }),

  (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Import validation failed',
        errors: errors.array().map(error => ({
          field: error.path,
          message: error.msg,
          value: error.value
        }))
      });
    }

    next();
  }
];

// Validation for search requests
const validateSearchRequest = [
  body('query')
    .optional()
    .isString()
    .withMessage('Search query must be a string')
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters'),

  body('filters')
    .optional()
    .isObject()
    .withMessage('Filters must be an object'),

  body('sortBy')
    .optional()
    .isIn(['name', 'createdAt', 'updatedAt', 'usageCount'])
    .withMessage('Invalid sort field'),

  body('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),

  body('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  body('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Search validation failed',
        errors: errors.array().map(error => ({
          field: error.path,
          message: error.msg,
          value: error.value
        }))
      });
    }

    next();
  }
];

// Validation for sharing requests
const validateShareRequest = [
  body('isShared')
    .isBoolean()
    .withMessage('isShared must be a boolean'),

  body('teamId')
    .optional()
    .isMongoId()
    .withMessage('teamId must be a valid MongoDB ObjectId'),

  (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Share validation failed',
        errors: errors.array().map(error => ({
          field: error.path,
          message: error.msg,
          value: error.value
        }))
      });
    }

    next();
  }
];

// Rate limiting validation
const validateRateLimit = (req, res, next) => {
  // Check if user has exceeded rate limits for configuration operations
  const userConfigCount = req.user?.configCount || 0;
  const maxConfigs = req.user?.plan?.maxConfigs || 100;
  
  if (userConfigCount >= maxConfigs) {
    return res.status(429).json({
      success: false,
      message: 'Configuration limit exceeded. Please upgrade your plan or delete unused configurations.',
      limit: maxConfigs
    });
  }

  next();
};

// Security validation for configuration data
const validateConfigSecurity = (req, res, next) => {
  const configData = req.body;
  
  // Check for potentially dangerous settings
  const dangerousPatterns = [
    /password/i,
    /secret/i,
    /key/i,
    /token/i,
    /api_key/i
  ];

  const settingsStr = JSON.stringify(configData.settings || {});
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(settingsStr)) {
      return res.status(400).json({
        success: false,
        message: 'Configuration contains potentially sensitive data. Please use environment variables or secure storage.',
        suggestion: 'Store sensitive data in environment variables or use the secure configuration storage feature.'
      });
    }
  }

  next();
};

module.exports = {
  validateToolConfig,
  validateImportRequest,
  validateSearchRequest,
  validateShareRequest,
  validateRateLimit,
  validateConfigSecurity
};