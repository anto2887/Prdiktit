// src/api/index.js
import apiClient, { api, APIError } from './client';
import * as authApi from './auth';
import * as usersApi from './users';
import * as matchesApi from './matches';
import * as predictionsApi from './predictions';
import * as groupsApi from './groups';

// Export all API functions
export {
    apiClient,
    api,
    APIError,
    authApi,
    usersApi,
    matchesApi,
    predictionsApi,
    groupsApi
};