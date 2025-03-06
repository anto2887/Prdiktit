// src/api/client.js
import axios from 'axios';
import { 
  formatApiResponse, 
  shouldCacheResponse, 
  createCacheKey 
} from './utils';

// Get API URL from environment variables with fallback
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

console.log('API_BASE_URL:', API_BASE_URL);

// Create custom error class for API errors
export class APIError extends Error {
  constructor(message, code, details = null) {
    super(message);
    this.name = 'APIError';
    this.code = code;
    this.details = details;
  }
}

// Basic cache implementation
const responseCache = new Map();

// Cache utilities
const getFromCache = (cacheKey) => {
  const cached = responseCache.get(cacheKey);
  if (!cached) return null;
  
  // Check if cache is expired
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

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true  // Important for handling credentials
});

console.log('Full API URL for auth register:', `${API_BASE_URL}/auth/register`);

// Request logging
const logRequest = (config) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`🌐 API Request: ${config.method.toUpperCase()} ${config.url}`, {
      headers: config.headers,
      data: config.data,
      params: config.params
    });
  }
  return config;
};

// Response logging
const logResponse = (response) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`✅ API Response: ${response.config.method.toUpperCase()} ${response.config.url}`, {
      status: response.status,
      data: response.data
    });
  }
  return response;
};

// Error logging
const logError = (error) => {
  if (process.env.NODE_ENV === 'development') {
    console.error(`❌ API Error: ${error.config?.method.toUpperCase()} ${error.config?.url}`, {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
  }
  return Promise.reject(error);
};

// Request interceptor
apiClient.interceptors.request.use(async (config) => {
  try {
    // Log the request
    logRequest(config);

    // Check if we should try to use cached response
    if (config.method === 'get' && !config.headers['Cache-Control']) {
      const endpoint = config.url;
      if (shouldCacheResponse(endpoint)) {
        const cacheKey = createCacheKey(endpoint, config.params);
        config.cacheKey = cacheKey;
        
        // Add this to skip the interceptors chain if we find cached response
        const cachedResponse = getFromCache(cacheKey);
        if (cachedResponse) {
          return {
            ...config,
            adapter: () => {
              return Promise.resolve({
                data: cachedResponse,
                status: 200,
                statusText: 'OK',
                headers: {},
                config,
                cached: true
              });
            }
          };
        }
      }
    }

    // Add authorization token if available
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    // Add timestamp for cache busting where needed
    if (config.method === 'get' && config.headers['Cache-Control'] === 'no-cache') {
      config.params = {
        ...config.params,
        _t: Date.now()
      };
    }

    return config;
  } catch (error) {
    return Promise.reject(error);
  }
}, logError);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    // Skip for cached responses
    if (response.cached) {
      return response.data;
    }
    
    // Log the response
    logResponse(response);

    // Store in cache if appropriate
    if (response.config.cacheKey) {
      addToCache(response.config.cacheKey, response.data);
    }

    // Check if the response has the expected structure
    if (response.data && typeof response.data === 'object') {
      if (response.data.status === 'error') {
        throw new APIError(
          response.data.message || 'An error occurred',
          response.status,
          response.data.details
        );
      }
      return response.data;
    }
    
    // Format response to ensure consistent structure
    return formatApiResponse(response.data);
  },
  async (error) => {
    // Log the error
    logError(error);

    const originalRequest = error.config;
    
    // Handle different error scenarios
    if (error.response) {
      const { status } = error.response;
      
      // Handle 401 Unauthorized
      if (status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        try {
          // Check auth status
          const response = await apiClient.get('/auth/status');
          if (!response.data?.authenticated) {
            // Clear token and redirect to login
            localStorage.removeItem('accessToken');
            
            // If we're not already on the login page, redirect
            if (window.location.pathname !== '/login') {
              window.location.href = '/login';
            }
            
            return Promise.reject(new APIError('Authentication required', 401));
          }
        } catch (e) {
          localStorage.removeItem('accessToken');
          
          // If we're not already on the login page, redirect
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          
          return Promise.reject(new APIError('Authentication required', 401));
        }
      }

      // Handle 403 Forbidden
      if (status === 403) {
        return Promise.reject(new APIError('Access denied', 403));
      }

      // Handle 404 Not Found
      if (status === 404) {
        return Promise.reject(new APIError('Resource not found', 404));
      }

      // Handle 422 Validation Error
      if (status === 422) {
        return Promise.reject(new APIError(
          'Validation error',
          422,
          error.response.data.errors
        ));
      }

      // Handle 429 Too Many Requests
      if (status === 429) {
        return Promise.reject(new APIError('Too many requests, please try again later', 429));
      }

      // Handle 500 Internal Server Error
      if (status >= 500) {
        return Promise.reject(new APIError('Server error', status));
      }

      // Handle other error responses
      return Promise.reject(new APIError(
        error.response.data?.message || 'An error occurred',
        status,
        error.response.data?.details
      ));
    }

    // Handle network errors
    if (error.request) {
      return Promise.reject(new APIError('Network error. Please check your connection.', 0));
    }

    // Handle other errors
    return Promise.reject(new APIError('An unexpected error occurred', 0));
  }
);

// Helper methods for common operations
export const api = {
  get: (url, config = {}) => apiClient.get(url, config),
  post: (url, data = {}, config = {}) => apiClient.post(url, data, config),
  put: (url, data = {}, config = {}) => apiClient.put(url, data, config),
  delete: (url, config = {}) => apiClient.delete(url, config),
  patch: (url, data = {}, config = {}) => apiClient.patch(url, data, config),
  
  // Cache control
  clearCache: clearCache
};

export default apiClient;