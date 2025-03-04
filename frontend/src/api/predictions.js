import { handleApiError, getDefaultHeaders, formatQueryParams } from './utils';

const BASE_URL = '/api/predictions';

/**
 * Submit a new prediction
 * @param {number} fixtureId - Fixture ID
 * @param {number} score1 - Home team score
 * @param {number} score2 - Away team score
 * @returns {Promise<Object>} Prediction data
 */
export const submitPrediction = async (fixtureId, score1, score2) => {
  try {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: getDefaultHeaders(),
      body: JSON.stringify({
        fixture_id: fixtureId,
        score1,
        score2,
      }),
      credentials: 'include',
    });

    if (!response.ok) {
      throw await handleApiError(response);
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
};

/**
 * Get prediction by ID
 * @param {number} predictionId - Prediction ID
 * @returns {Promise<Object>} Prediction data
 */
export const getPrediction = async (predictionId) => {
  try {
    const response = await fetch(`${BASE_URL}/${predictionId}`, {
      headers: getDefaultHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      throw await handleApiError(response);
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
};

/**
 * Update an existing prediction
 * @param {number} predictionId - Prediction ID
 * @param {number} score1 - New home team score
 * @param {number} score2 - New away team score
 * @returns {Promise<Object>} Updated prediction data
 */
export const updatePrediction = async (predictionId, score1, score2) => {
  try {
    const response = await fetch(`${BASE_URL}/${predictionId}`, {
      method: 'PUT',
      headers: getDefaultHeaders(),
      body: JSON.stringify({
        score1,
        score2,
      }),
      credentials: 'include',
    });

    if (!response.ok) {
      throw await handleApiError(response);
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
};

/**
 * Reset a prediction to editable state
 * @param {number} predictionId - Prediction ID
 * @returns {Promise<Object>} Response data
 */
export const resetPrediction = async (predictionId) => {
  try {
    const response = await fetch(`${BASE_URL}/reset/${predictionId}`, {
      method: 'POST',
      headers: getDefaultHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      throw await handleApiError(response);
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
};

/**
 * Get user predictions with optional filters
 * @param {Object} params - Query parameters
 * @param {number} [params.fixture_id] - Filter by fixture
 * @param {string} [params.status] - Filter by prediction status
 * @returns {Promise<Object>} User predictions data
 */
export const getUserPredictions = async (params = {}) => {
  try {
    const queryString = formatQueryParams(params);
    const response = await fetch(`${BASE_URL}/user${queryString}`, {
      headers: getDefaultHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      throw await handleApiError(response);
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
};