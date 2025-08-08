// src/api/index.js
import axios from 'axios';
import { enhancedSchedulerApi, enhancedSchedulerUtils } from './enhancedScheduler';
import SeasonManager from '../utils/seasonManager';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

// Add debug logging
process.env.NODE_ENV === 'development' && console.log('API module initializing with base URL:', API_BASE_URL);

// Add utils.js functions
const getDefaultHeaders = () => {
  const headers = {
    'Content-Type': 'application/json'
  };

  const token = localStorage.getItem('accessToken');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

const handleApiError = async (response) => {
  let errorMessage = 'An error occurred';
  let errorDetails = null;

  try {
    const errorData = await response.json();
    errorMessage = errorData.message || errorMessage;
    errorDetails = errorData.details || null;
  } catch (e) {
    errorMessage = response.statusText || errorMessage;
  }

  const error = new Error(errorMessage);
  error.status = response.status;
  error.details = errorDetails;
  return error;
};

const formatQueryParams = (params = {}) => {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, value);
    }
  });
  return queryParams.toString() ? `?${queryParams.toString()}` : '';
};

const createCacheKey = (endpoint, params = {}) => {
  const queryString = formatQueryParams(params);
  return `${endpoint}${queryString}`;
};

const shouldCacheResponse = (endpoint) => {
  const cachableEndpoints = [
    '/matches/fixtures',
    '/matches/statuses',
    '/groups/teams'
  ];
  return cachableEndpoints.some(e => endpoint.startsWith(e));
};

const formatApiResponse = (data) => {
  if (data && data.status) {
    return data;
  }
  return {
    status: 'success',
    data: data
  };
};

// Add cache implementation from client.js
const responseCache = new Map();

const getFromCache = (cacheKey) => {
  const cached = responseCache.get(cacheKey);
  if (!cached) return null;
  
  if (cached.expiry && Date.now() > cached.expiry) {
    responseCache.delete(cacheKey);
    return null;
  }
  
  return cached.data;
};

const addToCache = (cacheKey, data, ttlMinutes = 5) => {
  const expiry = Date.now() + (ttlMinutes * 60 * 1000);
  responseCache.set(cacheKey, { data, expiry });
};

const clearCache = () => {
  responseCache.clear();
};

// API Error class
export class APIError extends Error {
  constructor(message, status, details = null) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.details = details;
  }
}

// Main API class
class API {
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: { 'Content-Type': 'application/json' },
      withCredentials: true,
      // Add CORS configuration
      xsrfCookieName: 'csrftoken',
      xsrfHeaderName: 'X-CSRFToken',
    });
    
    this.setupInterceptors();
  }

  setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(config => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      // Log request for debugging
      process.env.NODE_ENV === 'development' && console.log('API Request:', {
        method: config.method,
        url: config.url,
        params: config.params,
        headers: config.headers
      });
      return config;
    });

    // Response interceptor
    this.client.interceptors.response.use(
      response => {
        // Log successful response for debugging
        process.env.NODE_ENV === 'development' && console.log('API Response:', {
          status: response.status,
          data: response.data
        });
        return this.formatApiResponse(response.data);
      },
      error => {
        // Log error for debugging
        process.env.NODE_ENV === 'development' && console.error('API Error:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status
        });
        if (error.response?.status === 401) {
          localStorage.removeItem('accessToken');
        }
        throw new APIError(
          error.response?.data?.message || error.message,
          error.response?.status || 0,
          error.response?.data?.details
        );
      }
    );
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
}

// Create API instance
const api = new API();

// Export API namespaces
export const authApi = {
  login: async (username, password) => {
    const response = await api.client.post('/auth/login', { username, password });
    if (response.status === 'success' && response.data?.access_token) {
      localStorage.setItem('accessToken', response.data.access_token);
    }
    return response;
  },
  register: async (userData) => {
    process.env.NODE_ENV === 'development' && console.log('🔍 REGISTER DEBUG: Starting registration with data:', userData);
    process.env.NODE_ENV === 'development' && console.log('🔍 REGISTER DEBUG: API base URL:', API_BASE_URL);
    process.env.NODE_ENV === 'development' && console.log('🔍 REGISTER DEBUG: Full URL will be:', `${API_BASE_URL}/auth/register`);
    
    try {
      const response = await api.client.post('/auth/register', userData);
      process.env.NODE_ENV === 'development' && console.log('🔍 REGISTER DEBUG: Registration successful:', response);
      return response;
    } catch (error) {
      process.env.NODE_ENV === 'development' && console.error('🔍 REGISTER DEBUG: Registration failed:', error);
      process.env.NODE_ENV === 'development' && console.error('🔍 REGISTER DEBUG: Error response:', error.response);
      process.env.NODE_ENV === 'development' && console.error('🔍 REGISTER DEBUG: Error status:', error.response?.status);
      process.env.NODE_ENV === 'development' && console.error('🔍 REGISTER DEBUG: Error data:', error.response?.data);
      throw error;
    }
  },
  logout: async () => {
    try {
      const response = await api.client.post('/auth/logout');
      localStorage.removeItem('accessToken');
      return response;
    } catch (error) {
      localStorage.removeItem('accessToken');
      throw error;
    }
  },
  checkAuthStatus: () => api.client.get('/auth/status')
};

export const groupsApi = {
  getUserGroups: async () => {
    try {
      process.env.NODE_ENV === 'development' && console.log('API: Fetching user groups...');
      const response = await api.client.get('/groups');
      process.env.NODE_ENV === 'development' && console.log('API: getUserGroups response:', response);
      process.env.NODE_ENV === 'development' && console.log('API: response.data:', response.data);
      process.env.NODE_ENV === 'development' && console.log('API: response.data.data:', response.data.data);
      
      // FIXED: Check if the response has the expected structure
      if (response && response.data) {
        // Case 1: Backend returns ListResponse directly
        if (response.data.status === 'success' && Array.isArray(response.data.data)) {
          process.env.NODE_ENV === 'development' && console.log('API: Returning backend ListResponse directly:', response.data);
          return response.data;  // Return {status, data, total}
        }
        // Case 2: Response is already formatted by interceptor
        else if (Array.isArray(response.data)) {
          process.env.NODE_ENV === 'development' && console.log('API: Response is array, wrapping in ListResponse format:', response.data);
          return {
            status: 'success',
            message: '',
            data: response.data,
            total: response.data.length
          };
        }
      }
      
      // Fallback: return empty response
      process.env.NODE_ENV === 'development' && console.log('API: No valid data found, returning empty response');
      return {
        status: 'success',
        message: '',
        data: [],
        total: 0
      };
    } catch (error) {
      process.env.NODE_ENV === 'development' && console.error('API: Error fetching user groups:', error);
      throw error;
    }
  },

  getGroupById: async (groupId) => {
    try {
      process.env.NODE_ENV === 'development' && console.log(`🌐 API: getGroupById called for groupId: ${groupId}`);
      // Add cache-busting timestamp
      const timestamp = Date.now();
      const response = await api.client.get(`/groups/${groupId}?_t=${timestamp}`);
      process.env.NODE_ENV === 'development' && console.log(`🌐 API: getGroupById response for groupId ${groupId}:`, response.data);
      return {
        status: 'success',
        data: response.data
      };
    } catch (error) {
      process.env.NODE_ENV === 'development' && console.error(`🌐 API: getGroupById error for groupId ${groupId}:`, error);
      throw new APIError(
        error.message || 'Failed to fetch group details',
        error.response?.status || 500
      );
    }
  },

  getGroupMembers: async (groupId) => {
    try {
      // Always fetch fresh member data with cache-busting
      const timestamp = Date.now();
      process.env.NODE_ENV === 'development' && console.log(`API: Fetching members for group ${groupId} (fresh)`);
      const response = await api.client.get(`/groups/${groupId}/members?_t=${timestamp}`);
      process.env.NODE_ENV === 'development' && console.log(`API: Got ${response.data?.length || 0} members for group ${groupId}`);
      return {
        status: 'success',
        data: response.data || []
      };
    } catch (error) {
      process.env.NODE_ENV === 'development' && console.error(`API: Error fetching group members for ${groupId}:`, error);
      throw new APIError(
        error.message || 'Failed to fetch group members',
        error.response?.status || 500
      );
    }
  },

  createGroup: async (groupData) => {
    try {
      process.env.NODE_ENV === 'development' && console.log('API: Creating group with data:', groupData);
      const response = await api.client.post('/groups', groupData);
      process.env.NODE_ENV === 'development' && console.log('API: Group creation response:', response);
      return {
        status: 'success',
        data: response.data
      };
    } catch (error) {
      throw new APIError(
        error.message || 'Failed to create group',
        error.response?.status || 500
      );
    }
  },

  updateGroup: async (groupId, groupData) => {
    try {
      const response = await api.client.put(`/groups/${groupId}`, groupData);
      return {
        status: 'success',
        data: response.data
      };
    } catch (error) {
      throw new APIError(
        error.message || 'Failed to update group',
        error.response?.status || 500
      );
    }
  },

  joinGroup: async (inviteCode) => {
    try {
      const response = await api.client.post('/groups/join', { invite_code: inviteCode });
      return {
        status: 'success',
        data: response.data
      };
    } catch (error) {
      throw new APIError(
        error.message || 'Failed to join group',
        error.response?.status || 500
      );
    }
  },

  leaveGroup: async (groupId) => {
    try {
      const response = await api.client.post(`/groups/${groupId}/leave`);
      return {
        status: 'success',
        data: response.data
      };
    } catch (error) {
      throw new APIError(
        error.message || 'Failed to leave group',
        error.response?.status || 500
      );
    }
  },

  manageMember: async (groupId, userId, action) => {
    try {
      const response = await api.client.post(`/groups/${groupId}/members`, {
        user_ids: [userId],
        action
      });
      return {
        status: 'success',
        data: response.data
      };
    } catch (error) {
      throw new APIError(
        error.message || 'Failed to perform member action',
        error.response?.status || 500
      );
    }
  },

  fetchTeamsForLeague: async (leagueId) => {
    try {
      process.env.NODE_ENV === 'development' && console.log('API: Fetching teams for league:', leagueId);
      const response = await api.client.get(`/groups/teams?league=${encodeURIComponent(leagueId)}`);
      return {
        status: 'success',
        data: response.data || []
      };
    } catch (error) {
      throw new APIError(
        error.message || 'Failed to fetch teams',
        error.response?.status || 500
      );
    }
  },

  regenerateInviteCode: async (groupId) => {
    try {
      const response = await api.client.post(`/groups/${groupId}/regenerate-code`);
      return {
        status: 'success',
        data: response.data
      };
    } catch (error) {
      throw new APIError(
        error.message || 'Failed to regenerate invite code',
        error.response?.status || 500
      );
    }
  }
};

export const matchesApi = {
  getLiveMatches: async () => {
    try {
      const response = await api.client.get('/matches/live');
      return response;
    } catch (error) {
      process.env.NODE_ENV === 'development' && console.error('Error fetching live matches:', error);
      return { status: 'success', data: [] };
    }
  },
  
  getMatchById: async (matchId) => {
    try {
      const response = await api.client.get(`/matches/${matchId}`);
      return response;
    } catch (error) {
      process.env.NODE_ENV === 'development' && console.error(`Error fetching match ${matchId}:`, error);
      return { status: 'success', data: null };
    }
  },
  
  getFixtures: async (params = {}) => {
    try {
      if (params.from) {
        if (params.from instanceof Date) {
          params.from = params.from.toISOString().split('T')[0];
        } else if (typeof params.from === 'string' && params.from.includes('T')) {
          params.from = params.from.split('T')[0];
        }
      }
      
      if (params.to) {
        if (params.to instanceof Date) {
          params.to = params.to.toISOString().split('T')[0];
        } else if (typeof params.to === 'string' && params.to.includes('T')) {
          params.to = params.to.split('T')[0];
        }
      }
      
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          params[key] = String(params[key]);
        }
      });
      
      process.env.NODE_ENV === 'development' && console.log('Fetching fixtures with params:', params);
      const response = await api.client.get('/matches/fixtures', { params });
      return response;
    } catch (error) {
      process.env.NODE_ENV === 'development' && console.error('Error fetching fixtures:', error);
      return { status: 'success', matches: [], total: 0 };
    }
  },
  
  getLeagueFixtures: async (leagueId, season) => {
    try {
      const response = await api.client.get('/matches/fixtures', { 
        params: { league: leagueId, season } 
      });
      return response;
    } catch (error) {
      process.env.NODE_ENV === 'development' && console.error('Error fetching league fixtures:', error);
      return { status: 'success', matches: [], total: 0 };
    }
  },
  
  getMatchStatuses: async () => {
    try {
      const response = await api.client.get('/matches/statuses');
      return response;
    } catch (error) {
      process.env.NODE_ENV === 'development' && console.error('Error fetching match statuses:', error);
      return { status: 'success', data: [] };
    }
  },
  
  getUpcomingMatches: async () => {
    try {
      const response = await api.client.get('/matches/upcoming');
      return response;
    } catch (error) {
      process.env.NODE_ENV === 'development' && console.error('Error fetching upcoming matches:', error);
      return { status: 'success', matches: [], total: 0 };
    }
  },
  
  getTopMatches: async (count = 5) => {
    try {
      const response = await api.client.get(`/matches/top?count=${count}`);
      return response;
    } catch (error) {
      process.env.NODE_ENV === 'development' && console.error('Error fetching top matches:', error);
      return { status: 'success', matches: [], total: 0 };
    }
  }
};

export const predictionsApi = {
  getPredictionById: (predictionId) => api.client.get(`/predictions/${predictionId}`),
  
  getUserPredictions: async (params = {}) => {
    try {
      const queryParams = {};
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams[key] = String(value);
        }
      });
      
      return await api.client.get('/predictions/user', { params: queryParams });
    } catch (error) {
      process.env.NODE_ENV === 'development' && console.error('Error fetching user predictions:', error);
      return { status: 'success', data: [] };
    }
  },

  createPrediction: async (predictionData) => {
    const payload = {
      match_id: predictionData.match_id !== undefined ? predictionData.match_id : predictionData.fixture_id,
      home_score: predictionData.home_score !== undefined ? predictionData.home_score : predictionData.score1,
      away_score: predictionData.away_score !== undefined ? predictionData.away_score : predictionData.score2
    };
    
    process.env.NODE_ENV === 'development' && console.log('Sending prediction data:', payload);
    
    if (payload.match_id === undefined || payload.home_score === undefined || payload.away_score === undefined) {
      process.env.NODE_ENV === 'development' && console.error('Missing required fields:', payload);
      throw new Error(`Missing required fields: match_id=${payload.match_id}, home_score=${payload.home_score}, away_score=${payload.away_score}`);
    }
    
    return await api.client.post('/predictions', payload);
  },

  updatePrediction: async (predictionId, predictionData) => {
    const payload = {};
    
    if ('home_score' in predictionData) {
      payload.home_score = predictionData.home_score;
    } else if ('score1' in predictionData) {
      payload.home_score = predictionData.score1;
    }
    
    if ('away_score' in predictionData) {
      payload.away_score = predictionData.away_score;
    } else if ('score2' in predictionData) {
      payload.away_score = predictionData.score2;
    }
    
    process.env.NODE_ENV === 'development' && console.log('Updating prediction with payload:', payload);
    
    return await api.client.put(`/predictions/${predictionId}`, payload);
  },

  resetPrediction: (predictionId) => api.client.post(`/predictions/reset/${predictionId}`),

  createBatchPredictions: async (predictionsData) => {
    const formattedData = {
      predictions: {}
    };
    
    Object.entries(predictionsData.predictions || predictionsData).forEach(([fixtureId, scores]) => {
      formattedData.predictions[fixtureId] = {
        home: scores.home !== undefined ? scores.home : scores.score1,
        away: scores.away !== undefined ? scores.away : scores.score2
      };
    });
    
    return await api.client.post('/predictions/batch', formattedData);
  },

  getPredictionStats: () => api.client.get('/predictions/stats'),

  // UPDATED: Enhanced leaderboard API with season management
  getGroupLeaderboard: async (groupId, params = {}) => {
    try {
      const queryParams = {};
      
      // Handle season parameter with proper formatting
      if (params.season && params.league) {
        // Normalize season format for the specific league
        const normalizedSeason = SeasonManager.normalizeSeasonForQuery(params.league, params.season);
        queryParams.season = normalizedSeason;
      } else if (params.season) {
        queryParams.season = params.season;
      }
      
      // Handle other parameters
      Object.entries(params).forEach(([key, value]) => {
        if (key !== 'season' && key !== 'league' && value !== undefined && value !== null) {
          queryParams[key] = String(value);
        }
      });
      
      process.env.NODE_ENV === 'development' && console.log(`Fetching leaderboard for group ${groupId} with params:`, queryParams);
      
      return await api.client.get(`/predictions/leaderboard/${groupId}`, { params: queryParams });
    } catch (error) {
      process.env.NODE_ENV === 'development' && console.error('Error fetching group leaderboard:', error);
      return {
        status: 'success',
        data: []
      };
    }
  },

  // NEW: Get available seasons for a group
  getGroupSeasons: async (groupId) => {
    try {
      return await api.client.get(`/predictions/seasons/${groupId}`);
    } catch (error) {
      process.env.NODE_ENV === 'development' && console.error('Error fetching group seasons:', error);
      return {
        status: 'success',
        data: []
      };
    }
  }
};

export const usersApi = {
  getUserProfile: () => api.client.get('/users/profile'),
  updateUserProfile: (userData) => api.client.put('/users/profile', userData),
  getUserStats: (userId) => api.client.get(`/users/stats${userId ? `?user_id=${userId}` : ''}`),
  getUserPredictions: (userId, params = {}) => api.client.get(`/users/predictions${userId ? `?user_id=${userId}` : ''}`, { params })
};

export const schedulerApi = {
  getStatus: () => api.client.get('/debug/scheduler-status'),
  triggerProcessing: () => api.client.post('/debug/trigger-processing'),
  triggerMonitoring: () => api.client.post('/debug/trigger-fixture-monitoring'),
  getMonitoringStatus: () => api.client.get('/debug/fixture-monitoring-status'),
  recalculateSchedule: () => api.client.post('/debug/recalculate-schedule')
};

// NEW: Season management API
export const seasonsApi = {
  getAvailableSeasons: async (league = null) => {
    try {
      const params = league ? { league } : {};
      return await api.client.get('/matches/seasons', { params });
    } catch (error) {
      process.env.NODE_ENV === 'development' && console.error('Error fetching available seasons:', error);
      return {
        status: 'success',
        data: league ? [] : {}
      };
    }
  }
};

// Add debug logging for enhanced scheduler
process.env.NODE_ENV === 'development' && console.log('Enhanced Scheduler API loaded:', Object.keys(enhancedSchedulerApi));

// Add debug logging
process.env.NODE_ENV === 'development' && console.log('API module loaded, predictionsApi methods:', Object.keys(predictionsApi));
process.env.NODE_ENV === 'development' && console.log('API module loaded, groupsApi methods:', Object.keys(groupsApi));

// Export utility functions
export {
  getDefaultHeaders,
  handleApiError,
  formatQueryParams,
  createCacheKey,
  shouldCacheResponse,
  formatApiResponse,
  clearCache,
  enhancedSchedulerApi,        // Import from separate file
  enhancedSchedulerUtils       // Import from separate file
};

export default api;