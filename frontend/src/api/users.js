import { handleApiError, getDefaultHeaders, formatQueryParams } from './utils';

const BASE_URL = '/api/users';

/**
 * Get current user's profile
 * @returns {Promise<Object>} User profile data
 */
export const getUserProfile = async () => {
  try {
    const response = await fetch(`${BASE_URL}/profile`, {
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
 * Update user profile
 * @param {Object} profileData - Profile data to update
 * @param {string} [profileData.username] - New username
 * @returns {Promise<Object>} Updated profile data
 */
export const updateUserProfile = async (profileData) => {
  try {
    const response = await fetch(`${BASE_URL}/profile`, {
      method: 'PUT',
      headers: getDefaultHeaders(),
      body: JSON.stringify(profileData),
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
 * Get user statistics
 * @param {number} [userId] - User ID (optional, defaults to current user)
 * @returns {Promise<Object>} User statistics
 */
export const getUserStats = async (userId) => {
  try {
    const response = await fetch(`${BASE_URL}/stats${userId ? `?user_id=${userId}` : ''}`, {
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
 * Get user prediction history
 * @param {Object} params - Query parameters
 * @param {number} [params.user_id] - Filter by user ID
 * @param {string} [params.season] - Filter by season
 * @param {number} [params.week] - Filter by week
 * @param {number} [params.group_id] - Filter by group
 * @returns {Promise<Object>} Prediction history data
 */
export const getPredictionHistory = async (params = {}) => {
  try {
    const queryString = formatQueryParams(params);
    const response = await fetch(`${BASE_URL}/predictions${queryString}`, {
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