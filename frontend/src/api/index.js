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

// Update APIError class with additional functionality
class APIError extends Error {
  constructor(message, status, details = null) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.details = details;
  }
}

// Update API class with cache and interceptors
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
    // Request interceptor with caching
    this.client.interceptors.request.use(async (config) => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`🌐 API Request: ${config.method.toUpperCase()} ${config.url}`, {
          headers: config.headers,
          data: config.data,
          params: config.params
        });
      }

      if (config.method === 'get' && !config.headers['Cache-Control']) {
        const endpoint = config.url;
        if (shouldCacheResponse(endpoint)) {
          const cacheKey = createCacheKey(endpoint, config.params);
          config.cacheKey = cacheKey;
          
          const cachedResponse = getFromCache(cacheKey);
          if (cachedResponse) {
            return {
              ...config,
              adapter: () => Promise.resolve({
                data: cachedResponse,
                status: 200,
                statusText: 'OK',
                headers: {},
                config,
                cached: true
              })
            };
          }
        }
      }

      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }

      return config;
    });

    // Response interceptor with improved error handling
    this.client.interceptors.response.use(
      (response) => {
        if (response.cached) {
          return response.data;
        }

        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ API Response: ${response.config.method.toUpperCase()} ${response.config.url}`, {
            status: response.status,
            data: response.data
          });
        }

        if (response.config.cacheKey) {
          addToCache(response.config.cacheKey, response.data);
        }

        return this.formatApiResponse(response.data);
      },
      async (error) => {
        if (process.env.NODE_ENV === 'development') {
          console.error(`❌ API Error: ${error.config?.method?.toUpperCase() || 'UNKNOWN'} ${error.config?.url || 'UNKNOWN'}`, {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
          });
        }

        if (error.response?.status === 401) {
          localStorage.removeItem('accessToken');
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
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
    return formatApiResponse(data);
  }
}

const api = new API();

// Update authApi with additional methods from auth.js
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

  checkAuthStatus: () => api.client.get('/auth/status'),

  isAuthenticated: () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return false;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiry = payload.exp * 1000;
      
      if (Date.now() >= expiry) {
        localStorage.removeItem('accessToken');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error checking token:', error);
      localStorage.removeItem('accessToken');
      return false;
    }
  },

  getAuthToken: () => localStorage.getItem('accessToken')
};

// Update usersApi with additional methods from users.js
export const usersApi = {
  getUserProfile: () => api.client.get('/users/profile'),
  
  updateUserProfile: (data) => api.client.put('/users/profile', data),
  
  getUserStats: (userId) => api.client.get(`/users/stats${userId ? `?user_id=${userId}` : ''}`),
  
  getPredictionHistory: async (params = {}) => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value);
      }
    });
    
    const queryString = queryParams.toString();
    const endpoint = queryString ? `/users/predictions?${queryString}` : '/users/predictions';
    
    return await api.client.get(endpoint);
  }
};

export const groupsApi = {
  getUserGroups: async () => {
    try {
      console.log('Fetching user groups...');
      const response = await api.client.get('/groups');
      console.log('Groups response:', response);
      
      // Ensure we're returning the data in the expected format
      if (response && response.status === 'success') {
        return response.data || [];
      }
      
      return response;
    } catch (error) {
      console.error('Error fetching user groups:', error);
      // Return a consistent error structure
      throw new APIError(
        error.message || 'Failed to fetch groups',
        error.status || 500
      );
    }
  },

  getGroupById: (groupId) => api.client.get(`/groups/${groupId}`),
  
  createGroup: (groupData) => api.client.post('/groups', groupData),
  
  updateGroup: (groupId, groupData) => api.client.put(`/groups/${groupId}`, groupData),
  
  joinGroup: (inviteCode) => api.client.post('/groups/join', { invite_code: inviteCode }),
  
  leaveGroup: (groupId) => api.client.post(`/groups/${groupId}/leave`),
  
  getGroupMembers: (groupId) => api.client.get(`/groups/${groupId}/members`),
  
  manageMember: (groupId, userId, action) => 
    api.client.post(`/groups/${groupId}/members`, { user_ids: [userId], action }),
  
  regenerateInviteCode: (groupId) => api.client.post(`/groups/${groupId}/regenerate-code`),
  
  getGroupAnalytics: async (groupId, params = {}) => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value);
      }
    });
    
    const queryString = queryParams.toString();
    const endpoint = queryString 
      ? `/groups/${groupId}/analytics?${queryString}` 
      : `/groups/${groupId}/analytics`;
    
    return await api.client.get(endpoint);
  },
  
  getGroupAuditLogs: (groupId, limit = 20) => api.client.get(`/groups/${groupId}/audit-logs?limit=${limit}`),

  fetchTeamsForLeague: async (leagueId) => {
    try {
      console.log('Fetching teams for league:', leagueId);
      
      const leagueMap = {
        'PL': 'Premier League',
        'LL': 'La Liga',
        'UCL': 'UEFA Champions League'
      };
      
      const mappedLeague = leagueMap[leagueId] || leagueId;
      const encodedLeague = encodeURIComponent(mappedLeague);
      
      const response = await api.client.get(`/groups/teams?league=${encodedLeague}`);
      
      if (response && response.status === 'success') {
        console.log(`Successfully fetched ${response.data?.length || 0} teams for ${mappedLeague}`);
        return response;
      } else {
        console.error('Error fetching teams:', response?.message);
        return { status: 'success', data: [] };
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
      throw new APIError(
        error.message || 'Failed to fetch teams',
        error.status || 500
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

export { APIError };
export default api;