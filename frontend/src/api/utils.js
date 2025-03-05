// src/api/utils.js
/**
 * Get default headers for API requests
 * @returns {Object} Headers object
 */
export const getDefaultHeaders = () => {
    const headers = {
      'Content-Type': 'application/json'
    };
  
    const token = localStorage.getItem('accessToken');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  
    return headers;
  };
  
  /**
   * Handle API error responses
   * @param {Response} response - Fetch response object
   * @returns {Promise<Error>} Error object
   */
  export const handleApiError = async (response) => {
    let errorMessage = 'An error occurred';
    let errorDetails = null;
  
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
      errorDetails = errorData.details || null;
    } catch (e) {
      // If JSON parsing fails, use status text
      errorMessage = response.statusText || errorMessage;
    }
  
    const error = new Error(errorMessage);
    error.status = response.status;
    error.details = errorDetails;
    return error;
  };
  
  /**
   * Format query parameters for API requests
   * @param {Object} params - Query parameters
   * @returns {string} Formatted query string
   */
  export const formatQueryParams = (params = {}) => {
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value);
      }
    });
    
    const queryString = queryParams.toString();
    return queryString ? `?${queryString}` : '';
  };
  
  /**
   * Create a cache key for API requests
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Query parameters
   * @returns {string} Cache key
   */
  export const createCacheKey = (endpoint, params = {}) => {
    const queryString = formatQueryParams(params);
    return `${endpoint}${queryString}`;
  };
  
  /**
   * Check if response should be cached
   * @param {string} endpoint - API endpoint
   * @returns {boolean} Should cache response
   */
  export const shouldCacheResponse = (endpoint) => {
    const cachableEndpoints = [
      '/matches/fixtures',
      '/matches/statuses',
      '/groups/teams'
    ];
    
    return cachableEndpoints.some(e => endpoint.startsWith(e));
  };
  
  /**
   * Format response for consistent structure
   * @param {Object} data - Response data
   * @returns {Object} Formatted response
   */
  export const formatApiResponse = (data) => {
    // If data already has status field, return as is
    if (data && data.status) {
      return data;
    }
    
    return {
      status: 'success',
      data: data
    };
  };