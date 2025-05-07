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
 * @param {number} predictionData.match_id - Match ID (fixture_id)
 * @param {number} predictionData.home_score - Home team score
 * @param {number} predictionData.away_score - Away team score
 * @returns {Promise<Object>} Created prediction
 */
export const createPrediction = async (predictionData) => {
  // Map our frontend data to match the backend expectations
  const payload = {
    match_id: predictionData.match_id || predictionData.fixture_id,
    home_score: predictionData.home_score || predictionData.score1,
    away_score: predictionData.away_score || predictionData.score2
  };
  
  console.log('Sending prediction data:', payload);
  
  return await api.post('/predictions', payload);
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
  // Map our frontend data to match the backend expectations
  const payload = {};
  
  if ('home_score' in predictionData || 'score1' in predictionData) {
    payload.home_score = predictionData.home_score || predictionData.score1;
  }
  
  if ('away_score' in predictionData || 'score2' in predictionData) {
    payload.away_score = predictionData.away_score || predictionData.score2;
  }
  
  return await api.put(`/predictions/${predictionId}`, payload);
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
    // Ensure all params are properly formatted
    const queryParams = {};
    
    // Handle fixture_id parameter
    if (params.fixture_id !== undefined && params.fixture_id !== null) {
      queryParams.fixture_id = Number(params.fixture_id);
    }
    
    // Handle status parameter
    if (params.status) {
      queryParams.status = params.status;
    }
    
    // Handle season parameter
    if (params.season) {
      queryParams.season = params.season;
    }
    
    // Handle week parameter
    if (params.week !== undefined && params.week !== null) {
      queryParams.week = Number(params.week);
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
  // Make sure we have the right structure
  // Convert score1/score2 to home/away if needed
  const formattedData = {
    predictions: {}
  };
  
  Object.entries(predictionsData.predictions || predictionsData).forEach(([fixtureId, scores]) => {
    formattedData.predictions[fixtureId] = {
      home: scores.home !== undefined ? scores.home : scores.score1,
      away: scores.away !== undefined ? scores.away : scores.score2
    };
  });
  
  return await api.post('/predictions/batch', formattedData);
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
  // Convert all params to strings
  const queryParams = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams[key] = String(value);
    }
  });
  
  return await api.get(`/predictions/leaderboard/${groupId}`, { params: queryParams });
};