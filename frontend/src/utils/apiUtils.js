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