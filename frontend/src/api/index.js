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

    this.setupInterceptors();
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

const api = new API();

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

export const usersApi = {
  // ... user methods ...
};

export const groupsApi = {
  // ... simplified group methods ...
};

export const matchesApi = {
  // ... simplified match methods ...
};

export const predictionsApi = {
  // ... simplified prediction methods ...
};

export { APIError };
export default api;