// src/utils/routeUtils.js

/**
 * Generate path with parameters
 * @param {string} path - Base path with parameter placeholders
 * @param {Object} params - Route parameters
 * @returns {string} Path with parameters
 */
export const generatePath = (path, params = {}) => {
    let result = path;
    
    // Replace path parameters
    Object.keys(params).forEach(key => {
      const value = params[key];
      const pattern = new RegExp(`:${key}(?=\\W|$)`, 'g');
      result = result.replace(pattern, value);
    });
    
    return result;
  };
  
  /**
   * Parse query parameters from URL
   * @param {string} search - Search query string from URL
   * @returns {Object} Parsed query parameters
   */
  export const parseQueryParams = (search) => {
    const params = new URLSearchParams(search);
    const result = {};
    
    for (const [key, value] of params.entries()) {
      result[key] = value;
    }
    
    return result;
  };
  
  /**
   * Build query string from object
   * @param {Object} params - Query parameters
   * @returns {string} Query string
   */
  export const buildQueryString = (params = {}) => {
    const query = new URLSearchParams();
    
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        query.append(key, params[key]);
      }
    });
    
    const queryString = query.toString();
    return queryString ? `?${queryString}` : '';
  };
  
  /**
   * Generate a URL with path parameters and query string
   * @param {string} path - Base path with parameter placeholders
   * @param {Object} pathParams - Path parameters
   * @param {Object} queryParams - Query parameters
   * @returns {string} Full URL
   */
  export const generateUrl = (path, pathParams = {}, queryParams = {}) => {
    const generatedPath = generatePath(path, pathParams);
    const queryString = buildQueryString(queryParams);
    
    return `${generatedPath}${queryString}`;
  };
  
  /**
   * Get previous route from location state
   * @param {Object} location - Location object from React Router
   * @param {string} defaultPath - Default path to return if no previous route
   * @returns {string} Previous route or default path
   */
  export const getPreviousRoute = (location, defaultPath = '/') => {
    return location?.state?.from?.pathname || defaultPath;
  };
  
  /**
   * Define application routes
   * Constants for all route paths to maintain consistency
   */
  export const ROUTES = {
    HOME: '/',
    LOGIN: '/login',
    REGISTER: '/register',
    DASHBOARD: '/dashboard',
    PROFILE: '/profile',
    SETTINGS: '/settings',
    PREDICTIONS: '/predictions',
    PREDICTION_NEW: '/predictions/new',
    PREDICTION_EDIT: '/predictions/edit/:id',
    PREDICTION_HISTORY: '/predictions/history',
    GROUPS: '/groups',
    GROUP_CREATE: '/groups/create',
    GROUP_JOIN: '/groups/join',
    GROUP_DETAILS: '/groups/:groupId',
    GROUP_MANAGE: '/groups/:groupId/manage',
    NOT_FOUND: '*'
  };