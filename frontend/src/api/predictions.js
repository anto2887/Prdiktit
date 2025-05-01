// src/api/predictions.js
import { api } from './client';

/**
 * Get prediction by ID
 * @param {number} predictionId - Prediction ID
 * @returns {Promise<Object>} Prediction data
 */
export const getPredictionById = async (predictionId) => {
  return await api.get(`/predictions/${predictionId}`);
};

/**
 * Create a new prediction
 * @param {Object} predictionData - Prediction data
 * @param {number} predictionData.match_id - Match ID (note: match_id vs fixture_id!)
 * @param {number} predictionData.home_score - Home team score
 * @param {number} predictionData.away_score - Away team score
 * @returns {Promise<Object>} Created prediction
 */
export const createPrediction = async (predictionData) => {
  // Make sure we're using the right field names
  const dataToSend = {
    match_id: predictionData.match_id || predictionData.fixture_id,
    home_score: predictionData.home_score || predictionData.score1,
    away_score: predictionData.away_score || predictionData.score2
  };
  
  return await api.post('/predictions', dataToSend);
};

/**
 * Update an existing prediction
 * @param {number} predictionId - Prediction ID
 * @param {Object} predictionData - Updated prediction data
 * @param {number} [predictionData.home_score] - Updated home team score
 * @param {number} [predictionData.away_score] - Updated away team score
 * @returns {Promise<Object>} Updated prediction
 */
export const updatePrediction = async (predictionId, predictionData) => {
  // Make sure we're using the right field names
  const dataToSend = {};
  
  if ('home_score' in predictionData || 'score1' in predictionData) {
    dataToSend.home_score = predictionData.home_score || predictionData.score1;
  }
  
  if ('away_score' in predictionData || 'score2' in predictionData) {
    dataToSend.away_score = predictionData.away_score || predictionData.score2;
  }
  
  return await api.put(`/predictions/${predictionId}`, dataToSend);
};

/**
 * Reset a prediction to editable state
 * @param {number} predictionId - Prediction ID
 * @returns {Promise<Object>} Reset prediction
 */
export const resetPrediction = async (predictionId) => {
  return await api.post(`/predictions/reset/${predictionId}`);
};

/**
 * Get user predictions with optional filters
 * @param {Object} params - Query parameters
 * @param {number} [params.fixture_id] - Filter by fixture
 * @param {string} [params.status] - Filter by prediction status
 * @param {string} [params.season] - Filter by season
 * @param {number} [params.week] - Filter by week
 * @returns {Promise<Object>} User predictions data
 */
export const getUserPredictions = async (params = {}) => {
  try {
    // Make a deep copy of params to avoid modifying the original
    const queryParams = { ...params };
    
    // Make sure all parameters are properly formatted
    if (queryParams.fixture_id && typeof queryParams.fixture_id !== 'number') {
      queryParams.fixture_id = parseInt(queryParams.fixture_id, 10);
      if (isNaN(queryParams.fixture_id)) {
        delete queryParams.fixture_id;
      }
    }
    
    if (queryParams.week && typeof queryParams.week !== 'number') {
      queryParams.week = parseInt(queryParams.week, 10);
      if (isNaN(queryParams.week)) {
        delete queryParams.week;
      }
    }
    
    // Log params for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('getUserPredictions params:', queryParams);
    }
    
    const response = await api.get('/predictions/user', { params: queryParams });
    return response;
  } catch (error) {
    console.error('Error fetching user predictions:', error);
    
    // Return a fallback empty response with correct structure
    return {
      status: 'success',
      matches: [],
      total: 0
    };
  }
};

/**
 * Create multiple predictions at once
 * @param {Object} predictionsData - Batch prediction data
 * @param {Object} predictionsData.predictions - Map of fixture IDs to scores
 * @returns {Promise<Object>} Created predictions
 */
export const createBatchPredictions = async (predictionsData) => {
  return await api.post('/predictions/batch', predictionsData);
};

/**
 * Get predictions statistics
 * @returns {Promise<Object>} Predictions statistics
 */
export const getPredictionStats = async () => {
  return await api.get('/predictions/stats');
};

/**
 * Get leaderboard for a specific group
 * @param {number} groupId - Group ID
 * @param {Object} params - Query parameters
 * @param {string} [params.season] - Filter by season
 * @param {number} [params.week] - Filter by week
 * @returns {Promise<Object>} Group leaderboard
 */
export const getGroupLeaderboard = async (groupId, params = {}) => {
  // Convert params object to query string
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, value);
    }
  });
  
  const queryString = queryParams.toString();
  const endpoint = queryString 
    ? `/predictions/leaderboard/${groupId}?${queryString}` 
    : `/predictions/leaderboard/${groupId}`;
  
  return await api.get(endpoint);
};