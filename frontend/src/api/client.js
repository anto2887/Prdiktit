// src/api/client.js
import axios from 'axios';

// Get API URL from environment variables with fallback
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api/v1';

// Create custom error class for API errors
export class APIError extends Error {
    constructor(message, code, details = null) {
        super(message);
        this.name = 'APIError';
        this.code = code;
        this.details = details;
    }
}

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    },
    withCredentials: true  // Important for handling credentials
});

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
        // Log the response
        logResponse(response);

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
        return response.data;
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
                        window.location.href = '/login';
                        return Promise.reject(new APIError('Authentication required', 401));
                    }
                } catch (e) {
                    localStorage.removeItem('accessToken');
                    window.location.href = '/login';
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
            return Promise.reject(new APIError('Network error', 0));
        }

        // Handle other errors
        return Promise.reject(new APIError('An unexpected error occurred', 0));
    }
);

export default apiClient;

// Helper methods for common operations
export const api = {
    get: (url, config = {}) => apiClient.get(url, config),
    post: (url, data = {}, config = {}) => apiClient.post(url, data, config),
    put: (url, data = {}, config = {}) => apiClient.put(url, data, config),
    delete: (url, config = {}) => apiClient.delete(url, config),
    patch: (url, data = {}, config = {}) => apiClient.patch(url, data, config)
};