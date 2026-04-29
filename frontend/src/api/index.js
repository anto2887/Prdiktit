// src/api/index.js
import axios from 'axios';
import { enhancedSchedulerApi, enhancedSchedulerUtils } from './enhancedScheduler';
import SeasonManager from '../utils/seasonManager';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://backend-production-4894.up.railway.app/api/v1';

// Add debug logging
process.env.NODE_ENV === 'development' && console.log('API module initializing with base URL:', API_BASE_URL);

// Add utils.js functions
const getDefaultHeaders = () => {
  const headers = {
    'Content-Type': 'application/json'
  };

  // Get session ID from context instead of localStorage
  const sessionId = window.sessionStorage.getItem('sessionId');
  if (sessionId) {
    headers['X-Session-ID'] = sessionId;
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
      // Get session ID from sessionStorage instead of localStorage
      const sessionId = window.sessionStorage.getItem('sessionId');
      if (sessionId) {
        config.headers['X-Session-ID'] = sessionId;
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
        
        // Handle session expiration
        if (error.response?.status === 401) {
          // Clear session and redirect to login
          window.sessionStorage.removeItem('sessionId');
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
      // Store session ID instead of access token
      if (response.data?.session_id) {
        window.sessionStorage.setItem('sessionId', response.data.session_id);
      }
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
      // Clear all JWT tokens from localStorage (legacy cleanup)
      localStorage.removeItem('accessToken');
      localStorage.removeItem('access_token');
      return response;
    } catch (error) {
      // Clear JWT tokens even if logout API fails
      localStorage.removeItem('accessToken');
      localStorage.removeItem('access_token');
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
    
    // Include group_id if provided
    if (predictionData.group_id !== undefined) {
      payload.group_id = predictionData.group_id;
    }
    
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
    
    // Include group_id if provided in predictionsData
    if (predictionsData.group_id !== undefined) {
      formattedData.group_id = predictionsData.group_id;
    }
    
    Object.entries(predictionsData.predictions || predictionsData).forEach(([fixtureId, scores]) => {
      // Skip group_id if it's at the top level
      if (fixtureId === 'group_id') return;
      
      formattedData.predictions[fixtureId] = {
        home: scores.home !== undefined ? scores.home : scores.score1,
        away: scores.away !== undefined ? scores.away : scores.score2
      };
    });
    
    return await api.client.post('/predictions/batch', formattedData);
  },

  getPredictionStats: () => api.client.get('/predictions/stats'),

  getGroupPredictions: async (groupId, week, season) => {
    try {
      process.env.NODE_ENV === 'development' && console.log(`🌐 API: getGroupPredictions called for groupId: ${groupId}, week: ${week}, season: ${season}`);
      const response = await api.client.get(`/predictions/group/${groupId}/week/${week}?season=${season}`);
      process.env.NODE_ENV === 'development' && console.log(`🌐 API: getGroupPredictions response:`, response.data);
      return response;
    } catch (error) {
      process.env.NODE_ENV === 'development' && console.error(`🌐 API: getGroupPredictions error:`, error);
      throw error;
    }
  },

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

export const analyticsApi = {
  getGroupAnalytics: async (groupId, season, week) => {
    try {
      process.env.NODE_ENV === 'development' &&
        console.log(`🌐 API: getGroupAnalytics groupId=${groupId} season=${season} week=${week}`);
      const response = await api.client.get(`/analytics/group/${groupId}`, {
        params: { season, week }
      });
      process.env.NODE_ENV === 'development' && console.log(`🌐 API: getGroupAnalytics response:`, response.data);
      return response;
    } catch (error) {
      process.env.NODE_ENV === 'development' && console.error(`🌐 API: getGroupAnalytics error:`, error);
      throw error;
    }
  },

  getUserAnalytics: async (userId, season, week) => {
    try {
      process.env.NODE_ENV === 'development' && console.log(`🌐 API: getUserAnalytics called for userId: ${userId}, season: ${season}, week: ${week}`);
      const response = await api.client.get(`/analytics/user/${userId}/analytics?season=${season}&week=${week}`);
      process.env.NODE_ENV === 'development' && console.log(`🌐 API: getUserAnalytics response:`, response.data);
      return response;
    } catch (error) {
      process.env.NODE_ENV === 'development' && console.error(`🌐 API: getUserAnalytics error:`, error);
      throw error;
    }
  },

  getGroupHeatmap: async (groupId, week, season) => {
    try {
      process.env.NODE_ENV === 'development' && console.log(`🌐 API: getGroupHeatmap called for groupId: ${groupId}, week: ${week}, season: ${season}`);
      const response = await api.client.get(`/analytics/group/${groupId}/heatmap?week=${week}&season=${season}`);
      process.env.NODE_ENV === 'development' && console.log(`🌐 API: getGroupHeatmap response:`, response.data);
      return response;
    } catch (error) {
      process.env.NODE_ENV === 'development' && console.error(`🌐 API: getGroupHeatmap error:`, error);
      throw error;
    }
  }
};

export const rivalriesApi = {
  getGroupRivalries: async (groupId) => {
    try {
      process.env.NODE_ENV === 'development' && console.log(`🌐 API: getGroupRivalries called for groupId: ${groupId}`);
      const response = await api.client.get(`/analytics/group/${groupId}/rivalries`);
      process.env.NODE_ENV === 'development' && console.log(`🌐 API: getGroupRivalries response:`, response.data);
      return response;
    } catch (error) {
      process.env.NODE_ENV === 'development' && console.error(`🌐 API: getGroupRivalries error:`, error);
      throw error;
    }
  },

  getComebackChallengeStatus: async (groupId) => {
    try {
      process.env.NODE_ENV === 'development' && console.log(`🌐 API: getComebackChallengeStatus called for groupId: ${groupId}`);
      const response = await api.client.get(`/admin/comeback-challenge-status/${groupId}`);
      process.env.NODE_ENV === 'development' && console.log(`🌐 API: getComebackChallengeStatus response:`, response.data);
      return response;
    } catch (error) {
      process.env.NODE_ENV === 'development' && console.error(`🌐 API: getComebackChallengeStatus error:`, error);
      throw error;
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

export const paymentsApi = {
  getWallet: async () => api.client.get('/payments/wallet'),
  getCoinBundles: async (countryCode = null) =>
    api.client.get('/payments/coin-bundles', {
      params: countryCode ? { country_code: countryCode } : {},
    }),
  createCheckoutSession: async (bundleId, countryCode = null) =>
    api.client.post('/payments/checkout-session', {
      bundle_id: bundleId,
      country_code: countryCode || undefined,
    }),
};

export const powerupsApi = {
  getCatalog: async () => api.client.get('/powerups/catalog'),
  activate: async (payload) => api.client.post('/powerups/activate', payload),
};

export const worldcupApi = {
  getGlobalLeaderboard: async (season = '2026', limit = 100) =>
    api.client.get('/worldcup/global-leaderboard', { params: { season, limit } }),
  getCanonicalStatus: async (season = '2026') =>
    api.client.get('/worldcup/canonical-status', { params: { season } }),
};

// Add debug logging for enhanced scheduler
process.env.NODE_ENV === 'development' && console.log('Enhanced Scheduler API loaded:', Object.keys(enhancedSchedulerApi));

// Add debug logging
process.env.NODE_ENV === 'development' && console.log('API module loaded, predictionsApi methods:', Object.keys(predictionsApi));
process.env.NODE_ENV === 'development' && console.log('API module loaded, groupsApi methods:', Object.keys(groupsApi));
process.env.NODE_ENV === 'development' && console.log('API module loaded, analyticsApi methods:', Object.keys(analyticsApi));
process.env.NODE_ENV === 'development' && console.log('API module loaded, rivalriesApi methods:', Object.keys(rivalriesApi));

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