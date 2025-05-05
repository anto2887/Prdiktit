// src/api/client.js
import axios from 'axios';
import { 
  formatApiResponse, 
  shouldCacheResponse, 
  createCacheKey 
} from './utils';

// Get API URL from environment variables with fallback
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

// Log the selected API URL for debugging
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

// Request interceptor
apiClient.interceptors.request.use(async (config) => {
  try {
    // Log the request (useful for debugging)
    if (process.env.NODE_ENV === 'development') {
      console.log(`🌐 API Request: ${config.method.toUpperCase()} ${config.url}`, {
        headers: config.headers,
        data: config.data,
        params: config.params
      });
    }

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
    } else if (!config.url.includes('/auth/login') && !config.url.includes('/auth/register')) {
      // For routes that require auth but no token, don't fail silently
      console.warn('No authentication token found for request:', config.url);
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
});

// Response interceptor with better error handling
apiClient.interceptors.response.use(
  (response) => {
    // Skip for cached responses
    if (response.cached) {
      return response.data;
    }
    
    // Log the response in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ API Response: ${response.config.method.toUpperCase()} ${response.config.url}`, {
        status: response.status,
        data: response.data
      });
    }

    // Store in cache if appropriate
    if (response.config.cacheKey) {
      addToCache(response.config.cacheKey, response.data);
    }

    // Handle various response structures consistently
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
    
    // Format response for consistency
    return formatApiResponse(response.data);
  },
  
  async (error) => {
    // Better error handling with detailed logging
    if (process.env.NODE_ENV === 'development') {
      console.error(`❌ API Error: ${error.config?.method?.toUpperCase() || 'UNKNOWN'} ${error.config?.url || 'UNKNOWN'}`, {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
        stack: error.stack
      });
    }

    // Handle different error scenarios with better user experience
    if (error.response) {
      const { status } = error.response;
      
      // Handle auth errors
      if (status === 401) {
        localStorage.removeItem('accessToken');
        // Only redirect if not already on login page
        if (window.location.pathname !== '/login') {
          // Use a less disruptive approach than full page redirect
          console.warn('Authentication required. Redirecting to login page.');
        }
        return Promise.reject(new APIError('Authentication required', 401));
      }

      // Handle validation errors better
      if (status === 422) {
        return Promise.reject(new APIError(
          'Please check your input',
          422,
          error.response.data.detail || error.response.data
        ));
      }

      // Handle server errors
      if (status >= 500) {
        return Promise.reject(new APIError(
          'Server error. Please try again later.',
          status,
          error.response.data?.details
        ));
      }
    }

    // Handle network errors
    if (error.request) {
      return Promise.reject(new APIError('Network error. Please check your connection.', 0));
    }

    // Handle other errors
    return Promise.reject(new APIError(error.message || 'An unexpected error occurred', 0));
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