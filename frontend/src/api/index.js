// src/api/index.js
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

// Add debug logging
console.log('API module initializing with base URL:', API_BASE_URL);

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
      console.log('API Request:', {
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
        console.log('API Response:', {
          status: response.status,
          data: response.data
        });
        return this.formatApiResponse(response.data);
      },
      error => {
        // Log error for debugging
        console.error('API Error:', {
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
  register: (userData) => api.client.post('/auth/register', userData),
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
      console.log('API: Fetching user groups...');
      const response = await api.client.get('/groups');
      console.log('API: getUserGroups response:', response);
      console.log('API: response.data:', response.data);
      console.log('API: response.data.data:', response.data.data);
      
      // FIXED: Check if the response has the expected structure
      if (response && response.data) {
        // Case 1: Backend returns ListResponse directly
        if (response.data.status === 'success' && Array.isArray(response.data.data)) {
          console.log('API: Returning backend ListResponse directly:', response.data);
          return response.data;  // Return {status, data, total}
        }
        // Case 2: Response is already formatted by interceptor
        else if (Array.isArray(response.data)) {
          console.log('API: Response is array, wrapping in ListResponse format:', response.data);
          return {
            status: 'success',
            message: '',
            data: response.data,
            total: response.data.length
          };
        }
      }
      
      // Fallback: return empty response
      console.log('API: No valid data found, returning empty response');
      return {
        status: 'success',
        message: '',
        data: [],
        total: 0
      };
    } catch (error) {
      console.error('API: Error fetching user groups:', error);
      throw error;
    }
  },

  getGroupById: async (groupId) => {
    try {
      // Add cache-busting timestamp
      const timestamp = Date.now();
      const response = await api.client.get(`/groups/${groupId}?_t=${timestamp}`);
      return {
        status: 'success',
        data: response.data
      };
    } catch (error) {
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
      console.log(`API: Fetching members for group ${groupId} (fresh)`);
      const response = await api.client.get(`/groups/${groupId}/members?_t=${timestamp}`);
      console.log(`API: Got ${response.data?.length || 0} members for group ${groupId}`);
      return {
        status: 'success',
        data: response.data || []
      };
    } catch (error) {
      console.error(`API: Error fetching group members for ${groupId}:`, error);
      throw new APIError(
        error.message || 'Failed to fetch group members',
        error.response?.status || 500
      );
    }
  },

  createGroup: async (groupData) => {
    try {
      console.log('API: Creating group with data:', groupData);
      const response = await api.client.post('/groups', groupData);
      console.log('API: Group creation response:', response);
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
      console.log('API: Fetching teams for league:', leagueId);
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
      console.error('Error fetching live matches:', error);
      return { status: 'success', data: [] };
    }
  },
  
  getMatchById: async (matchId) => {
    try {
      const response = await api.client.get(`/matches/${matchId}`);
      return response;
    } catch (error) {
      console.error(`Error fetching match ${matchId}:`, error);
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
      
      console.log('Fetching fixtures with params:', params);
      const response = await api.client.get('/matches/fixtures', { params });
      return response;
    } catch (error) {
      console.error('Error fetching fixtures:', error);
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
      console.error('Error fetching league fixtures:', error);
      return { status: 'success', matches: [], total: 0 };
    }
  },
  
  getMatchStatuses: async () => {
    try {
      const response = await api.client.get('/matches/statuses');
      return response;
    } catch (error) {
      console.error('Error fetching match statuses:', error);
      return { status: 'success', data: [] };
    }
  },
  
  getUpcomingMatches: async () => {
    try {
      const response = await api.client.get('/matches/upcoming');
      return response;
    } catch (error) {
      console.error('Error fetching upcoming matches:', error);
      return { status: 'success', matches: [], total: 0 };
    }
  },
  
  getTopMatches: async (count = 5) => {
    try {
      const response = await api.client.get(`/matches/top?count=${count}`);
      return response;
    } catch (error) {
      console.error('Error fetching top matches:', error);
      return { status: 'success', matches: [], total: 0 };
    }
  }
};

export const predictionsApi = {
  getPredictionById: (predictionId) => api.client.get(`/predictions/${predictionId}`),
  
  getUserPredictions: async (params = {}) => {
    try {
      const queryParams = {};
      
      if (params.fixture_id !== undefined && params.fixture_id !== null) {
        queryParams.fixture_id = Number(params.fixture_id);
      }
      
      if (params.status) {
        queryParams.status = params.status;
      }
      
      if (params.season) {
        queryParams.season = params.season;
      }
      
      if (params.week !== undefined && params.week !== null) {
        queryParams.week = Number(params.week);
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log('getUserPredictions params:', queryParams);
      }
      
      const response = await api.client.get('/predictions/user', { params: queryParams });
      return response;
    } catch (error) {
      console.error('Error fetching user predictions:', error);
      return {
        status: 'success',
        matches: [],
        total: 0
      };
    }
  },

  // FIXED: Properly handle 0 values
  createPrediction: async (predictionData) => {
    const payload = {
      match_id: predictionData.match_id ?? predictionData.fixture_id,
      home_score: predictionData.home_score !== undefined ? predictionData.home_score : predictionData.score1,
      away_score: predictionData.away_score !== undefined ? predictionData.away_score : predictionData.score2
    };
    
    console.log('Sending prediction data:', payload);
    
    // Validate that we have all required fields
    if (payload.match_id === undefined || payload.home_score === undefined || payload.away_score === undefined) {
      console.error('Missing required fields:', payload);
      throw new Error(`Missing required fields: match_id=${payload.match_id}, home_score=${payload.home_score}, away_score=${payload.away_score}`);
    }
    
    return await api.client.post('/predictions', payload);
  },

  // FIXED: Properly handle 0 values for updates too
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
    
    console.log('Updating prediction with payload:', payload);
    
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

  getGroupLeaderboard: async (groupId, params = {}) => {
    try {
      const queryParams = {};
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams[key] = String(value);
        }
      });
      
      return await api.client.get(`/predictions/leaderboard/${groupId}`, { params: queryParams });
    } catch (error) {
      console.error('Error fetching group leaderboard:', error);
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

// 🧠 Enhanced Smart Scheduler API - ADD THIS SECTION
const enhancedSchedulerApi = {
  /**
   * Get current Enhanced Smart Scheduler status
   * @returns {Promise<Object>} Scheduler status with mode, frequency, monitoring info
   */
  getStatus: async () => {
    try {
      const response = await api.client.get('/debug/scheduler-status');
      return formatApiResponse(response.data);
    } catch (error) {
      console.error('Error fetching scheduler status:', error);
      throw new APIError(
        error.response?.data?.message || 'Failed to fetch scheduler status',
        error.response?.status || 500,
        error.response?.data?.details
      );
    }
  },

  /**
   * Force recalculation of processing schedule
   * @returns {Promise<Object>} Old and new schedule information
   */
  recalculateSchedule: async () => {
    try {
      const response = await api.client.post('/debug/recalculate-schedule');
      return formatApiResponse(response.data);
    } catch (error) {
      console.error('Error recalculating schedule:', error);
      throw new APIError(
        error.response?.data?.message || 'Failed to recalculate schedule',
        error.response?.status || 500,
        error.response?.data?.details
      );
    }
  },

  /**
   * Manually trigger a processing cycle
   * @returns {Promise<Object>} Processing cycle results
   */
  triggerProcessing: async () => {
    try {
      const response = await api.client.post('/debug/trigger-processing');
      return formatApiResponse(response.data);
    } catch (error) {
      console.error('Error triggering processing:', error);
      throw new APIError(
        error.response?.data?.message || 'Failed to trigger processing',
        error.response?.status || 500,
        error.response?.data?.details
      );
    }
  },

  /**
   * Manually trigger fixture monitoring
   * @returns {Promise<Object>} Fixture monitoring results
   */
  triggerFixtureMonitoring: async () => {
    try {
      const response = await api.client.post('/debug/trigger-fixture-monitoring');
      return formatApiResponse(response.data);
    } catch (error) {
      console.error('Error triggering fixture monitoring:', error);
      throw new APIError(
        error.response?.data?.message || 'Failed to trigger fixture monitoring',
        error.response?.status || 500,
        error.response?.data?.details
      );
    }
  },

  /**
   * Get fixture monitoring status and recent changes
   * @returns {Promise<Object>} Fixture monitoring status
   */
  getFixtureMonitoringStatus: async () => {
    try {
      const response = await api.client.get('/debug/fixture-monitoring-status');
      return formatApiResponse(response.data);
    } catch (error) {
      console.error('Error fetching fixture monitoring status:', error);
      throw new APIError(
        error.response?.data?.message || 'Failed to fetch fixture monitoring status',
        error.response?.status || 500,
        error.response?.data?.details
      );
    }
  },

  /**
   * Get enhanced health check with scheduler info
   * @returns {Promise<Object>} Health status with scheduler details
   */
  getHealthStatus: async () => {
    try {
      const response = await api.client.get('/health');
      return formatApiResponse(response.data);
    } catch (error) {
      console.error('Error fetching health status:', error);
      throw new APIError(
        error.response?.data?.message || 'Failed to fetch health status',
        error.response?.status || 500,
        error.response?.data?.details
      );
    }
  }
};

// Enhanced Scheduler utility functions
const enhancedSchedulerUtils = {
  /**
   * Format scheduler mode for display
   * @param {string} mode - Scheduler mode (e.g., 'high_frequency', 'match_day', 'minimal')
   * @returns {Object} Display info with icon and description
   */
  formatSchedulerMode: (mode) => {
    const modes = {
      'high_frequency': {
        icon: '⚡',
        name: 'High Frequency',
        description: 'Live matches - every 2 minutes',
        color: 'text-red-500'
      },
      'match_day': {
        icon: '🔄',
        name: 'Match Day',
        description: 'Around match times - every 5 minutes',
        color: 'text-orange-500'
      },
      'moderate': {
        icon: '📊',
        name: 'Moderate',
        description: 'Regular processing - every 15 minutes',
        color: 'text-blue-500'
      },
      'minimal': {
        icon: '💤',
        name: 'Minimal',
        description: 'Quiet periods - every 30-60 minutes',
        color: 'text-gray-500'
      }
    };
    return modes[mode] || {
      icon: '❓',
      name: 'Unknown',
      description: 'Unknown mode',
      color: 'text-gray-400'
    };
  },

  /**
   * Format frequency in seconds to human readable
   * @param {number} seconds - Frequency in seconds
   * @returns {string} Human readable frequency
   */
  formatFrequency: (seconds) => {
    if (seconds < 60) {
      return `${seconds} seconds`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
      const hours = Math.floor(seconds / 3600);
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    }
  },

  /**
   * Check if scheduler is in optimal state
   * @param {Object} schedulerData - Scheduler status data
   * @returns {Object} Optimization status and suggestions
   */
  analyzeSchedulerHealth: (schedulerData) => {
    const issues = [];
    const suggestions = [];
    if (!schedulerData.is_running) {
      issues.push('Scheduler not running');
      suggestions.push('Restart the Enhanced Smart Scheduler');
    }
    if (!schedulerData.processor_available) {
      issues.push('Match processor not available');
      suggestions.push('Check match processor initialization');
    }
    if (!schedulerData.fixture_monitor_available) {
      issues.push('Fixture monitor not available');
      suggestions.push('Check fixture monitoring service');
    }
    if (schedulerData.todays_matches > 0 && !schedulerData.fixture_monitoring_enabled) {
      issues.push('Fixture monitoring disabled on match day');
      suggestions.push('Enable fixture monitoring for better accuracy');
    }
    return {
      isHealthy: issues.length === 0,
      issues,
      suggestions,
      score: Math.max(0, 100 - (issues.length * 25))
    };
  }
};

// Add debug logging for enhanced scheduler
console.log('Enhanced Scheduler API loaded:', Object.keys(enhancedSchedulerApi));

// Add debug logging
console.log('API module loaded, predictionsApi methods:', Object.keys(predictionsApi));
console.log('API module loaded, groupsApi methods:', Object.keys(groupsApi));

// Export utility functions
export {
  getDefaultHeaders,
  handleApiError,
  formatQueryParams,
  createCacheKey,
  shouldCacheResponse,
  formatApiResponse,
  clearCache,
  schedulerApi,
  enhancedSchedulerApi,        // ← ADD THIS
  enhancedSchedulerUtils       // ← ADD THIS
};

export default api;