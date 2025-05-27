// src/api/index.js
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

// Add debug logging
console.log('API module initializing...');

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
      withCredentials: true
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
      return config;
    });

    // Response interceptor
    this.client.interceptors.response.use(
      response => this.formatApiResponse(response.data),
      error => {
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
      
      // Ensure consistent response format
      if (response && response.status === 'success') {
        return {
          status: 'success',
          data: response.data || []
        };
      }
      return response;
    } catch (error) {
      console.error('API: Error fetching user groups:', error);
      throw error;
    }
  },

  getGroupById: async (groupId) => {
    try {
      const response = await api.client.get(`/groups/${groupId}`);
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
      const response = await api.client.get(`/groups/${groupId}/members`);
      return {
        status: 'success',
        data: response.data || []
      };
    } catch (error) {
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

  createPrediction: async (predictionData) => {
    const payload = {
      match_id: predictionData.match_id || predictionData.fixture_id,
      home_score: predictionData.home_score || predictionData.score1,
      away_score: predictionData.away_score || predictionData.score2
    };
    
    console.log('Sending prediction data:', payload);
    return await api.client.post('/predictions', payload);
  },

  updatePrediction: async (predictionId, predictionData) => {
    const payload = {};
    
    if ('home_score' in predictionData || 'score1' in predictionData) {
      payload.home_score = predictionData.home_score || predictionData.score1;
    }
    
    if ('away_score' in predictionData || 'score2' in predictionData) {
      payload.away_score = predictionData.away_score || predictionData.score2;
    }
    
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
  clearCache
};

export default api;