// src/api/auth.js
import { api } from './client';

/**
 * Login user and get authentication token
 * @param {string} username - Username
 * @param {string} password - Password
 * @returns {Promise<Object>} Response with auth token
 */
export const login = async (username, password) => {
  const response = await api.post('/auth/login', { username, password });
  
  // Store the token in localStorage if login is successful
  if (response.status === 'success' && response.data.access_token) {
    localStorage.setItem('accessToken', response.data.access_token);
  }
  
  return response;
};

/**
 * Register a new user
 * @param {Object} userData - User registration data
 * @param {string} userData.username - Username
 * @param {string} userData.password - Password
 * @param {string} [userData.email] - Email (optional)
 * @returns {Promise<Object>} Registration response
 */
export const register = async (userData) => {
  return await api.post('/auth/register', userData);
};

/**
 * Logout the current user
 * @returns {Promise<Object>} Logout response
 */
export const logout = async () => {
  try {
    const response = await api.post('/auth/logout');
    
    // Remove token regardless of response
    localStorage.removeItem('accessToken');
    
    return response;
  } catch (error) {
    // Still remove token on error
    localStorage.removeItem('accessToken');
    throw error;
  }
};

/**
 * Check authentication status
 * @returns {Promise<Object>} Auth status
 */
export const checkAuthStatus = async () => {
  return await api.get('/auth/status');
};

/**
 * Check if user is authenticated (token exists)
 * @returns {boolean} Is authenticated
 */
export const isAuthenticated = () => {
  const token = localStorage.getItem('accessToken');
  if (!token) {
    return false;
  }
  
  try {
    // Check if token is expired
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiry = payload.exp * 1000; // Convert to milliseconds
    
    if (Date.now() >= expiry) {
      // Token is expired
      localStorage.removeItem('accessToken');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error checking token:', error);
    localStorage.removeItem('accessToken');
    return false;
  }
};

/**
 * Get the current authentication token
 * @returns {string|null} Auth token or null
 */
export const getAuthToken = () => {
  return localStorage.getItem('accessToken');
};