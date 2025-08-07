// src/utils/apiUtils.js

/**
 * Construct URL with query parameters
 * @param {string} baseUrl - Base URL
 * @param {Object} params - Query parameters
 * @returns {string} URL with query parameters
 */
export const buildUrl = (baseUrl, params = {}) => {
    const url = new URL(baseUrl, window.location.origin);
    
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        url.searchParams.append(key, params[key]);
      }
    });
    
    return url.toString();
  };
  
  /**
   * Format error response for consistent error handling
   * @param {Error} error - Error object
   * @returns {Object} Formatted error response
   */
  export const formatErrorResponse = (error) => {
    // API errors with our standard structure
    if (error.status === 'error' && error.code) {
      return error; // Already in correct format
    }
    
    // Axios errors with response
    if (error.response && error.response.data) {
      return {
        status: 'error',
        code: error.response.status,
        message: error.response.data.message || 'An error occurred',
        details: error.response.data.details || null,
      };
    }
    
    // Network errors
    if (error.request) {
      return {
        status: 'error',
        code: 'NETWORK_ERROR',
        message: 'Network error. Please check your connection.',
        details: null,
      };
    }
    
    // Default error response
    return {
      status: 'error',
      code: 'UNKNOWN_ERROR',
      message: error.message || 'An unexpected error occurred',
      details: null,
    };
  };
  
  /**
   * Extract error message from error object or response
   * @param {Error|Object} error - Error object or response
   * @returns {string} Error message
   */
  export const extractErrorMessage = (error) => {
    if (!error) {
      return 'An unknown error occurred';
    }
    
    if (typeof error === 'string') {
      return error;
    }
    
    if (error.response && error.response.data) {
      return error.response.data.message || 'Server error';
    }
    
    if (error.message) {
      return error.message;
    }
    
    return 'An unexpected error occurred';
  };
  
  /**
   * Check if a response is successful
   * @param {Object} response - API response
   * @returns {boolean} Is successful response
   */
  export const isSuccessResponse = (response) => {
    return response && response.status === 'success';
  };
  
  /**
   * Parse response data or return default value
   * @param {Object} response - API response
   * @param {any} defaultValue - Default value if data is not found
   * @returns {any} Response data or default value
   */
  export const parseResponseData = (response, defaultValue = null) => {
    if (isSuccessResponse(response) && response.data !== undefined) {
      return response.data;
    }
    
    return defaultValue;
  };
  
  /**
   * Retry a function with exponential backoff
   * @param {Function} fn - Function to retry
   * @param {number} maxRetries - Maximum number of retries
   * @param {number} baseDelay - Base delay in milliseconds
   * @returns {Promise<any>} Function result
   */
  export const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 300) => {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // Only retry on network errors or 5xx server errors
        if (!error.request && (!error.response || error.response.status < 500)) {
          throw error;
        }
        
        const delay = baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  };

// Enhanced API error class
export class APIError extends Error {
  constructor(message, status, code, details = null) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

// Enhanced error handler that extends your existing formatErrorResponse
export const handleAPIError = (error, context = {}) => {
  const errorId = `API_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Use your existing formatErrorResponse as base
  const baseResponse = formatErrorResponse(error);
  
  // Enhance with additional info
  const enhancedResponse = {
    ...baseResponse,
    errorId,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
    context
  };
  
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('🚨 API Error:', enhancedResponse);
  }
  
  // Store for debugging
  try {
    const existingLogs = JSON.parse(localStorage.getItem('api_errors') || '[]');
    existingLogs.push(enhancedResponse);
    
    if (existingLogs.length > 20) {
      existingLogs.splice(0, existingLogs.length - 20);
    }
    
    localStorage.setItem('api_errors', JSON.stringify(existingLogs));
  } catch (e) {
    console.warn('Failed to store API error log:', e);
  }
  
  return enhancedResponse;
};

// Retry wrapper for API calls
export const withRetry = async (fn, options = {}) => {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    shouldRetry = (error) => {
      // Retry on network errors or 5xx server errors
      return !error.request || (error.response && error.response.status >= 500);
    }
  } = options;
  
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }
      
      const delay = Math.min(
        baseDelay * Math.pow(backoffFactor, attempt) + Math.random() * 1000,
        maxDelay
      );
      
      console.log(`Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};