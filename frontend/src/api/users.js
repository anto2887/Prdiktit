// src/api/users.js
import { api } from './client';

/**
 * Get current user's profile
 * @returns {Promise<Object>} User profile data
 */
export const getUserProfile = async () => {
  return await api.get('/users/profile');
};

/**
 * Update user profile
 * @param {Object} profileData - Profile data to update
 * @returns {Promise<Object>} Updated profile data
 */
export const updateUserProfile = async (profileData) => {
  return await api.put('/users/profile', profileData);
};

/**
 * Get user statistics
 * @param {number} [userId] - User ID (optional, defaults to current user)
 * @returns {Promise<Object>} User statistics
 */
export const getUserStats = async (userId) => {
  const endpoint = userId ? `/users/stats?user_id=${userId}` : '/users/stats';
  return await api.get(endpoint);
};

/**
 * Get user prediction history
 * @param {Object} params - Query parameters
 * @param {number} [params.user_id] - Filter by user ID
 * @param {string} [params.season] - Filter by season
 * @param {number} [params.week] - Filter by week
 * @param {string} [params.status] - Filter by prediction status
 * @param {number} [params.fixture_id] - Filter by fixture ID
 * @param {number} [params.group_id] - Filter by group
 * @returns {Promise<Object>} Prediction history data
 */
export const getPredictionHistory = async (params = {}) => {
  // Convert params object to query string
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, value);
    }
  });
  
  const queryString = queryParams.toString();
  const endpoint = queryString ? `/users/predictions?${queryString}` : '/users/predictions';
  
  return await api.get(endpoint);
};