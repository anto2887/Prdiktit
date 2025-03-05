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
 * @param {number} predictionData.fixture_id - Fixture ID
 * @param {number} predictionData.score1 - Home team score
 * @param {number} predictionData.score2 - Away team score
 * @returns {Promise<Object>} Created prediction
 */
export const createPrediction = async (predictionData) => {
  return await api.post('/predictions', predictionData);
};

/**
 * Update an existing prediction
 * @param {number} predictionId - Prediction ID
 * @param {Object} predictionData - Updated prediction data
 * @param {number} [predictionData.score1] - Updated home team score
 * @param {number} [predictionData.score2] - Updated away team score
 * @returns {Promise<Object>} Updated prediction
 */
export const updatePrediction = async (predictionId, predictionData) => {
  return await api.put(`/predictions/${predictionId}`, predictionData);
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
 * @returns {Promise<Object>} User predictions data
 */
export const getUserPredictions = async (params = {}) => {
  // Convert params object to query string
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, value);
    }
  });
  
  const queryString = queryParams.toString();
  const endpoint = queryString ? `/predictions/user?${queryString}` : '/predictions/user';
  
  return await api.get(endpoint);
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