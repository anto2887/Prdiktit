// src/api/index.js
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

class APIError extends Error {
  constructor(message, status, details = null) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.details = details;
  }
}

class API {
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: { 'Content-Type': 'application/json' },
      withCredentials: true
    });

    // Cache configuration
    this.cachableEndpoints = [
      '/matches/fixtures',
      '/matches/statuses',
      '/groups/teams'
    ];

    this.setupInterceptors();
  }

  // Utility methods
  formatQueryParams(params = {}) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value);
      }
    });
    return queryParams.toString();
  }

  createCacheKey(endpoint, params = {}) {
    const queryString = this.formatQueryParams(params);
    return `${endpoint}${queryString ? `?${queryString}` : ''}`;
  }

  shouldCacheResponse(endpoint) {
    return this.cachableEndpoints.some(e => endpoint.startsWith(e));
  }

  formatApiResponse(data) {
    if (data && data.status) {
      return data;
    }
    return {
      status: 'success',
      data: data
    };
  }

  setupInterceptors() {
    // Request interceptor (replaces getDefaultHeaders)
    this.client.interceptors.request.use(config => {
      const token = localStorage.getItem('accessToken');
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });

    // Response interceptor (combines handleApiError and formatApiResponse)
    this.client.interceptors.response.use(
      response => this.formatApiResponse(response.data),
      error => {
        if (error.response?.status === 401) {
          localStorage.removeItem('accessToken');
          window.location.href = '/login';
        }
        throw new APIError(
          error.response?.data?.message || error.message,
          error.response?.status || 0,
          error.response?.data?.details
        );
      }
    );
  }

  createResource(name) {
    return {
      getAll: (params = {}) => this.client.get(`/${name}`, { params }),
      getById: (id) => this.client.get(`/${name}/${id}`),
      create: (data) => this.client.post(`/${name}`, data),
      update: (id, data) => this.client.put(`/${name}/${id}`, data),
      delete: (id) => this.client.delete(`/${name}/${id}`)
    };
  }

  // Auth endpoints
  auth = {
    login: (username, password) => this.client.post('/auth/login', { username, password }),
    register: (userData) => this.client.post('/auth/register', userData),
    logout: () => this.client.post('/auth/logout'),
    status: () => this.client.get('/auth/status')
  };

  // Dynamic resources
  get users() { return this.createResource('users'); }
  get groups() { return this.createResource('groups'); }
  get matches() { return this.createResource('matches'); }
  get predictions() { return this.createResource('predictions'); }

  // Custom endpoints
  custom = {
    // User specific
    getUserProfile: () => this.client.get('/users/profile'),
    updateUserProfile: (data) => this.client.put('/users/profile', data),
    getUserStats: (userId) => this.client.get(`/users/stats${userId ? `?user_id=${userId}` : ''}`),
    getUserPredictions: (params = {}) => this.client.get('/predictions/user', { params }),

    // Groups specific
    joinGroup: (inviteCode) => this.client.post('/groups/join', { invite_code: inviteCode }),
    leaveGroup: (groupId) => this.client.post(`/groups/${groupId}/leave`),
    getGroupMembers: (groupId) => this.client.get(`/groups/${groupId}/members`),
    manageMember: (groupId, userId, action) => 
      this.client.post(`/groups/${groupId}/members`, { user_ids: [userId], action }),
    regenerateInviteCode: (groupId) => this.client.post(`/groups/${groupId}/regenerate-code`),
    getTeams: (league) => this.client.get(`/groups/teams?league=${encodeURIComponent(league)}`),

    // Matches specific
    getLiveMatches: () => this.client.get('/matches/live'),
    getFixtures: (params = {}) => this.client.get('/matches/fixtures', { params }),
    getUpcomingMatches: () => this.client.get('/matches/upcoming'),

    // Predictions specific
    createBatchPredictions: (predictions) => this.client.post('/predictions/batch', predictions),
    resetPrediction: (predictionId) => this.client.post(`/predictions/reset/${predictionId}`)
  };
}

export const api = new API();
export { APIError };
export default api;