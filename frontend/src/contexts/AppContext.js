// src/contexts/AppContext.js
import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { authApi, usersApi, groupsApi, matchesApi, predictionsApi } from '../api';
import SeasonManager from '../utils/seasonManager';

// Create the main app context
const AppContext = createContext(null);

// Action types for the reducer
const ActionTypes = {
  // Auth actions
  SET_AUTH_LOADING: 'SET_AUTH_LOADING',
  SET_AUTH_USER: 'SET_AUTH_USER',
  SET_AUTH_ERROR: 'SET_AUTH_ERROR',
  CLEAR_AUTH: 'CLEAR_AUTH',
  
  // User actions
  SET_USER_LOADING: 'SET_USER_LOADING',
  SET_USER_PROFILE: 'SET_USER_PROFILE',
  SET_USER_STATS: 'SET_USER_STATS',
  SET_USER_ERROR: 'SET_USER_ERROR',
  CLEAR_USER_DATA: 'CLEAR_USER_DATA',
  
  // Groups actions
  SET_GROUPS_LOADING: 'SET_GROUPS_LOADING',
  SET_USER_GROUPS: 'SET_USER_GROUPS',
  SET_CURRENT_GROUP: 'SET_CURRENT_GROUP',
  SET_GROUP_MEMBERS: 'SET_GROUP_MEMBERS',
  SET_GROUPS_ERROR: 'SET_GROUPS_ERROR',
  CLEAR_GROUPS_DATA: 'CLEAR_GROUPS_DATA',
  
  // Matches actions
  SET_MATCHES_LOADING: 'SET_MATCHES_LOADING',
  SET_FIXTURES: 'SET_FIXTURES',
  SET_LIVE_MATCHES: 'SET_LIVE_MATCHES',
  SET_SELECTED_MATCH: 'SET_SELECTED_MATCH',
  SET_MATCHES_ERROR: 'SET_MATCHES_ERROR',
  CLEAR_MATCHES_DATA: 'CLEAR_MATCHES_DATA',
  
  // Predictions actions
  SET_PREDICTIONS_LOADING: 'SET_PREDICTIONS_LOADING',
  SET_USER_PREDICTIONS: 'SET_USER_PREDICTIONS',
  SET_SELECTED_PREDICTION: 'SET_SELECTED_PREDICTION',
  SET_PREDICTIONS_ERROR: 'SET_PREDICTIONS_ERROR',
  CLEAR_PREDICTIONS_DATA: 'CLEAR_PREDICTIONS_DATA',
  
  // Notifications actions
  ADD_NOTIFICATION: 'ADD_NOTIFICATION',
  REMOVE_NOTIFICATION: 'REMOVE_NOTIFICATION',
  CLEAR_NOTIFICATIONS: 'CLEAR_NOTIFICATIONS',
  
  // League actions
  SET_SELECTED_SEASON: 'SET_SELECTED_SEASON',
  SET_SELECTED_WEEK: 'SET_SELECTED_WEEK',
  SET_SELECTED_GROUP: 'SET_SELECTED_GROUP',
  SET_LEADERBOARD: 'SET_LEADERBOARD',
  SET_LEAGUE_LOADING: 'SET_LEAGUE_LOADING',
  SET_LEAGUE_ERROR: 'SET_LEAGUE_ERROR',
  
  // New user stats actions
  SET_USER_STATS_LOADING: 'SET_USER_STATS_LOADING',
  SET_USER_STATS_ERROR: 'SET_USER_STATS_ERROR',
  
  // Season management actions
  SET_AVAILABLE_SEASONS: 'SET_AVAILABLE_SEASONS',
  CLEAR_LEAGUE_DATA: 'CLEAR_LEAGUE_DATA',
};

// Initial state
const initialState = {
  auth: {
    user: null,
    loading: false,
    error: null,
    isAuthenticated: false
  },
  user: {
    profile: null,
    stats: null,
    loading: false,
    error: null,
    statsLoading: false,
    statsError: null
  },
  groups: {
    userGroups: [],
    currentGroup: null,
    groupMembers: [],
    loading: false,
    error: null
  },
  matches: {
    fixtures: [],
    liveMatches: [],
    selectedMatch: null,
    loading: false,
    error: null
  },
  predictions: {
    userPredictions: [],
    selectedPrediction: null,
    loading: false,
    error: null
  },
  notifications: {
    notifications: []
  },
  league: {
    selectedSeason: null, // Will be set dynamically based on group league
    selectedWeek: null,
    selectedGroup: null,
    leaderboard: [],
    availableSeasons: [],
    loading: false,
    error: null
  }
};

// Main reducer
const appReducer = (state, action) => {
  switch (action.type) {
    // Auth cases
    case ActionTypes.SET_AUTH_LOADING:
      return {
        ...state,
        auth: { ...state.auth, loading: action.payload }
      };
    
    case ActionTypes.SET_AUTH_USER:
      console.log('🔄 Reducer: SET_AUTH_USER', {
        payload: action.payload,
        isAuthenticated: !!action.payload,
        timestamp: new Date().toISOString()
      });
      return {
        ...state,
        auth: {
          ...state.auth,
          user: action.payload,
          isAuthenticated: !!action.payload,
          loading: false,
          error: null
        }
      };
    
    case ActionTypes.SET_AUTH_ERROR:
      return {
        ...state,
        auth: { ...state.auth, error: action.payload, loading: false }
      };
    
    case ActionTypes.CLEAR_AUTH:
      return {
        ...state,
        auth: { ...initialState.auth },
        user: { ...initialState.user },
        groups: { ...initialState.groups },
        predictions: { ...initialState.predictions }
      };
    
    // User cases
    case ActionTypes.SET_USER_LOADING:
      return {
        ...state,
        user: { ...state.user, loading: action.payload }
      };
    
    case ActionTypes.SET_USER_PROFILE:
      return {
        ...state,
        user: { ...state.user, profile: action.payload, loading: false, error: null }
      };
    
    case ActionTypes.SET_USER_STATS:
      return {
        ...state,
        user: { ...state.user, stats: action.payload }
      };
    
    case ActionTypes.SET_USER_ERROR:
      return {
        ...state,
        user: { ...state.user, error: action.payload, loading: false }
      };
    
    case ActionTypes.CLEAR_USER_DATA:
      return {
        ...state,
        user: { ...initialState.user }
      };
    
    // Groups cases
    case ActionTypes.SET_GROUPS_LOADING:
      return {
        ...state,
        groups: { ...state.groups, loading: action.payload }
      };
    
    case ActionTypes.SET_USER_GROUPS:
      return {
        ...state,
        groups: { ...state.groups, userGroups: action.payload, loading: false, error: null }
      };
    
    case ActionTypes.SET_CURRENT_GROUP:
      return {
        ...state,
        groups: { 
          ...state.groups, 
          currentGroup: action.payload 
        },
        // Reset season when changing groups - will be set based on new group's league
        league: {
          ...state.league,
          selectedSeason: null, // Will be set by GroupDetailsPage based on new group's league
          leaderboard: [],
          availableSeasons: []
        }
      };
    
    case ActionTypes.SET_GROUP_MEMBERS:
      return {
        ...state,
        groups: { ...state.groups, groupMembers: action.payload }
      };
    
    case ActionTypes.SET_GROUPS_ERROR:
      return {
        ...state,
        groups: { ...state.groups, error: action.payload, loading: false }
      };
    
    case ActionTypes.CLEAR_GROUPS_DATA:
      return {
        ...state,
        groups: { ...initialState.groups }
      };
    
    // Matches cases
    case ActionTypes.SET_MATCHES_LOADING:
      return {
        ...state,
        matches: { ...state.matches, loading: action.payload }
      };
    
    case ActionTypes.SET_FIXTURES:
      return {
        ...state,
        matches: { ...state.matches, fixtures: action.payload, loading: false, error: null }
      };
    
    case ActionTypes.SET_LIVE_MATCHES:
      return {
        ...state,
        matches: { ...state.matches, liveMatches: action.payload }
      };
    
    case ActionTypes.SET_SELECTED_MATCH:
      return {
        ...state,
        matches: { ...state.matches, selectedMatch: action.payload }
      };
    
    case ActionTypes.SET_MATCHES_ERROR:
      return {
        ...state,
        matches: { ...state.matches, error: action.payload, loading: false }
      };
    
    case ActionTypes.CLEAR_MATCHES_DATA:
      return {
        ...state,
        matches: { ...initialState.matches }
      };
    
    // Predictions cases
    case ActionTypes.SET_PREDICTIONS_LOADING:
      return {
        ...state,
        predictions: { ...state.predictions, loading: action.payload }
      };
    
    case ActionTypes.SET_USER_PREDICTIONS:
      return {
        ...state,
        predictions: { ...state.predictions, userPredictions: action.payload, loading: false, error: null }
      };
    
    case ActionTypes.SET_SELECTED_PREDICTION:
      return {
        ...state,
        predictions: { ...state.predictions, selectedPrediction: action.payload }
      };
    
    case ActionTypes.SET_PREDICTIONS_ERROR:
      return {
        ...state,
        predictions: { ...state.predictions, error: action.payload, loading: false }
      };
    
    case ActionTypes.CLEAR_PREDICTIONS_DATA:
      return {
        ...state,
        predictions: { ...initialState.predictions }
      };
    
    // Notifications cases
    case ActionTypes.ADD_NOTIFICATION:
      return {
        ...state,
        notifications: {
          notifications: [...state.notifications.notifications, action.payload]
        }
      };
    
    case ActionTypes.REMOVE_NOTIFICATION:
      return {
        ...state,
        notifications: {
          notifications: state.notifications.notifications.filter(n => n.id !== action.payload)
        }
      };
    
    case ActionTypes.CLEAR_NOTIFICATIONS:
      return {
        ...state,
        notifications: { notifications: [] }
      };
    
    // League cases
    case ActionTypes.SET_SELECTED_SEASON:
      return {
        ...state,
        league: { ...state.league, selectedSeason: action.payload }
      };
    
    case ActionTypes.SET_SELECTED_WEEK:
      return {
        ...state,
        league: { ...state.league, selectedWeek: action.payload }
      };
    
    case ActionTypes.SET_SELECTED_GROUP:
      return {
        ...state,
        league: { ...state.league, selectedGroup: action.payload }
      };
    
    case ActionTypes.SET_LEADERBOARD:
      return {
        ...state,
        league: { ...state.league, leaderboard: action.payload, loading: false, error: null }
      };
    
    case ActionTypes.SET_LEAGUE_LOADING:
      return {
        ...state,
        league: { ...state.league, loading: action.payload }
      };
    
    case ActionTypes.SET_LEAGUE_ERROR:
      return {
        ...state,
        league: { ...state.league, error: action.payload, loading: false }
      };
    
    // Season management cases
    case ActionTypes.SET_AVAILABLE_SEASONS:
      return {
        ...state,
        league: { 
          ...state.league, 
          availableSeasons: action.payload 
        }
      };
    
    case ActionTypes.CLEAR_LEAGUE_DATA:
      return {
        ...state,
        league: {
          ...initialState.league,
          selectedSeason: null // Reset to null, will be set based on group
        }
      };
    
    // New user stats cases
    case ActionTypes.SET_USER_STATS_LOADING:
      return {
        ...state,
        user: { ...state.user, statsLoading: action.payload }
      };
    
    case ActionTypes.SET_USER_STATS_ERROR:
      return {
        ...state,
        user: { ...state.user, statsError: action.payload }
      };
    
    default:
      return state;
  }
};

// Main Provider Component
export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  
  // Cache refs for preventing duplicate requests
  const fixturesCache = useRef({});
  const requestInProgress = useRef({});
  const refreshTimestamp = useRef(0);

  // Notification functions (defined early since they're used in other functions)
  const addNotification = useCallback((notification) => {
    const id = notification.id || uuidv4();
    const timeout = notification.timeout || 5000;

    const newNotification = {
      id,
      type: notification.type || 'info',
      message: notification.message,
      timeout
    };

    dispatch({ type: ActionTypes.ADD_NOTIFICATION, payload: newNotification });

    if (timeout > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, timeout);
    }

    return id;
  }, []);

  const removeNotification = useCallback((id) => {
    dispatch({ type: ActionTypes.REMOVE_NOTIFICATION, payload: id });
  }, []);

  const showSuccess = useCallback((message, timeout = 5000) => {
    return addNotification({
      type: 'success',
      message,
      timeout
    });
  }, [addNotification]);

  const showError = useCallback((message, timeout = 7000) => {
    return addNotification({
      type: 'error',
      message,
      timeout
    });
  }, [addNotification]);

  const showWarning = useCallback((message, timeout = 6000) => {
    return addNotification({
      type: 'warning',
      message,
      timeout
    });
  }, [addNotification]);

  const showInfo = useCallback((message, timeout = 5000) => {
    return addNotification({
      type: 'info',
      message,
      timeout
    });
  }, [addNotification]);

  const clearAllNotifications = useCallback(() => {
    dispatch({ type: ActionTypes.CLEAR_NOTIFICATIONS });
  }, []);

  // Check authentication on mount
  useEffect(() => {
    console.log('🚀 AppProvider: Starting authentication check on mount');
    checkAuth();
  }, []);

  // Auth functions
  const checkAuth = useCallback(async () => {
    try {
      console.log('🔐 checkAuth: Starting authentication check');
      dispatch({ type: ActionTypes.SET_AUTH_LOADING, payload: true });
      process.env.NODE_ENV === 'development' && console.log("Checking authentication...");
      
      const hasToken = localStorage.getItem('accessToken');
      console.log('🔐 checkAuth: Token check:', { hasToken: !!hasToken, tokenLength: hasToken?.length });
      
      if (!hasToken) {
        console.log('❌ checkAuth: No token found, setting unauthenticated');
        dispatch({ type: ActionTypes.SET_AUTH_USER, payload: null });
        return;
      }
      
      console.log('🔐 checkAuth: Verifying token with server...');
      const response = await authApi.checkAuthStatus();
      console.log('🔐 checkAuth: Server response:', response);
      
      if (response && response.status === 'success' && response.data?.authenticated) {
        console.log('✅ checkAuth: Token valid, setting authenticated');
        // Extract user data from response
        const userData = response.data.user;
        if (userData) {
          dispatch({ type: ActionTypes.SET_AUTH_USER, payload: userData });
        } else {
          // If no user data, set minimal authenticated state
          console.log('⚠️ checkAuth: No user data in auth check, will fetch profile after login');
          dispatch({ type: ActionTypes.SET_AUTH_USER, payload: { authenticated: true }});
        }
      } else {
        console.log('❌ checkAuth: Token invalid, clearing');
        dispatch({ type: ActionTypes.SET_AUTH_USER, payload: null });
        localStorage.removeItem('accessToken');
      }
    } catch (err) {
      console.error('❌ checkAuth: Auth check failed:', err);
      // Handle 401 errors differently
      if (err.status === 401 || err.message?.includes('401')) {
        console.log('❌ checkAuth: 401 error, clearing token and user');
        localStorage.removeItem('accessToken');
        dispatch({ type: ActionTypes.SET_AUTH_USER, payload: null });
      } else {
        console.log('❌ checkAuth: Other error, setting auth error');
        dispatch({ type: ActionTypes.SET_AUTH_ERROR, payload: err.message || 'Authentication check failed' });
      }
    }
  }, []);

  const login = useCallback(async (username, password) => {
    try {
      dispatch({ type: ActionTypes.SET_AUTH_LOADING, payload: true });
      dispatch({ type: ActionTypes.SET_AUTH_ERROR, payload: null });
      
      process.env.NODE_ENV === 'development' && console.log('Login: Attempting to log in user:', username);
      const response = await authApi.login(username, password);
      process.env.NODE_ENV === 'development' && console.log('Login: API response:', response);
      
      if (response.status === 'success') {
        // Extract user data from response
        const userData = response.data?.user;
        process.env.NODE_ENV === 'development' && console.log('Login: Setting user data:', userData);
        
        if (userData) {
          dispatch({ type: ActionTypes.SET_AUTH_USER, payload: userData });
          process.env.NODE_ENV === 'development' && console.log('Login: User authenticated successfully');
          return response;
        } else {
          throw new Error('User data not found in response');
        }
      }
      
      throw new Error(response.message || 'Login failed');
    } catch (err) {
      process.env.NODE_ENV === 'development' && console.error('Login: Error occurred:', err);
      dispatch({ type: ActionTypes.SET_AUTH_ERROR, payload: err.message });
      throw err;
    }
  }, []);

  const register = useCallback(async (userData) => {
    try {
      dispatch({ type: ActionTypes.SET_AUTH_LOADING, payload: true });
      dispatch({ type: ActionTypes.SET_AUTH_ERROR, payload: null });
      
      const response = await authApi.register(userData);
      
      if (response.status === 'success') {
        return response;
      }
      
      throw new Error(response.message || 'Registration failed');
    } catch (err) {
      dispatch({ type: ActionTypes.SET_AUTH_ERROR, payload: err.message || 'Registration failed' });
      throw err;
    } finally {
      dispatch({ type: ActionTypes.SET_AUTH_LOADING, payload: false });
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      dispatch({ type: ActionTypes.SET_AUTH_LOADING, payload: true });
      await authApi.logout();
      dispatch({ type: ActionTypes.CLEAR_AUTH });
    } catch (err) {
      process.env.NODE_ENV === 'development' && console.error('Logout error:', err);
      dispatch({ type: ActionTypes.CLEAR_AUTH });
    }
  }, []);

  const clearAuthError = useCallback(() => {
    dispatch({ type: ActionTypes.SET_AUTH_ERROR, payload: null });
  }, []);

  // User functions
  const fetchProfile = useCallback(async () => {
    if (!state.auth.isAuthenticated) return;
    
    try {
      dispatch({ type: ActionTypes.SET_USER_LOADING, payload: true });
      dispatch({ type: ActionTypes.SET_USER_ERROR, payload: null });
      
      process.env.NODE_ENV === 'development' && console.log('AppContext: Calling usersApi.getUserProfile...');
      const response = await usersApi.getUserProfile();
      process.env.NODE_ENV === 'development' && console.log('AppContext: getUserProfile response:', response);
      
      if (response.status === 'success') {
        if (response.data && response.data.user) {
          dispatch({ type: ActionTypes.SET_USER_PROFILE, payload: response.data.user });
          dispatch({ type: ActionTypes.SET_USER_STATS, payload: response.data.stats || {
            total_points: 0,
            total_predictions: 0,
            perfect_predictions: 0,
            average_points: 0.0
          }});
        } else {
          dispatch({ type: ActionTypes.SET_USER_PROFILE, payload: {
            id: response.data.id,
            username: response.data.username,
            email: response.data.email,
            created_at: response.data.created_at
          }});
          dispatch({ type: ActionTypes.SET_USER_STATS, payload: response.data.stats || {
            total_points: 0,
            total_predictions: 0,
            perfect_predictions: 0,
            average_points: 0.0
          }});
        }
      } else {
        process.env.NODE_ENV === 'development' && console.warn("Profile fetch returned non-success status:", response.message);
        dispatch({ type: ActionTypes.SET_USER_PROFILE, payload: { username: "User" }});
        dispatch({ type: ActionTypes.SET_USER_STATS, payload: { total_points: 0, total_predictions: 0, average_points: 0 }});
      }
    } catch (err) {
      process.env.NODE_ENV === 'development' && console.error("Error fetching profile:", err);
      dispatch({ type: ActionTypes.SET_USER_ERROR, payload: "Unable to load profile data" });
      dispatch({ type: ActionTypes.SET_USER_PROFILE, payload: { username: "User" }});
      dispatch({ type: ActionTypes.SET_USER_STATS, payload: { total_points: 0, total_predictions: 0, average_points: 0 }});
    }
  }, [state.auth.isAuthenticated]);

  const updateProfile = useCallback(async (userData) => {
    try {
      dispatch({ type: ActionTypes.SET_USER_LOADING, payload: true });
      dispatch({ type: ActionTypes.SET_USER_ERROR, payload: null });
      
      const response = await usersApi.updateUserProfile(userData);
      
      if (response.status === 'success') {
        await fetchProfile();
        return true;
      } else {
        throw new Error(response.message || 'Failed to update profile');
      }
    } catch (err) {
      dispatch({ type: ActionTypes.SET_USER_ERROR, payload: err.message || 'Failed to update profile' });
      showError(err.message || 'Failed to update profile');
      return false;
    }
  }, [fetchProfile, showError]);

  // Groups functions
  const fetchUserGroups = useCallback(async () => {
    if (!state.auth.isAuthenticated) return [];
    
    try {
      dispatch({ type: ActionTypes.SET_GROUPS_LOADING, payload: true });
      dispatch({ type: ActionTypes.SET_GROUPS_ERROR, payload: null });
      
      process.env.NODE_ENV === 'development' && console.log('AppContext: Calling groupsApi.getUserGroups...');
      const response = await groupsApi.getUserGroups();
      process.env.NODE_ENV === 'development' && console.log('AppContext: getUserGroups response:', response);
      
      if (response && response.status === 'success' && Array.isArray(response.data)) {
        process.env.NODE_ENV === 'development' && console.log('AppContext: Setting groups to:', response.data);
        dispatch({ type: ActionTypes.SET_USER_GROUPS, payload: response.data });
        return response.data;
      } else {
        process.env.NODE_ENV === 'development' && console.warn('AppContext: Invalid response format:', response);
        dispatch({ type: ActionTypes.SET_USER_GROUPS, payload: [] });
        return [];
      }
    } catch (err) {
      process.env.NODE_ENV === 'development' && console.error('AppContext: Error in fetchUserGroups:', err);
      dispatch({ type: ActionTypes.SET_GROUPS_ERROR, payload: err.message || 'Failed to fetch groups' });
      dispatch({ type: ActionTypes.SET_USER_GROUPS, payload: [] });
      return [];
    } finally {
      dispatch({ type: ActionTypes.SET_GROUPS_LOADING, payload: false });
    }
  }, [state.auth.isAuthenticated]);

  const fetchGroupDetails = useCallback(async (groupId) => {
    process.env.NODE_ENV === 'development' && console.log('🏢 fetchGroupDetails START:', { 
      groupId, 
      isAuthenticated: state.auth.isAuthenticated,
      currentGroupId: state.groups.currentGroup?.id 
    });
    
    if (!state.auth.isAuthenticated || !groupId) {
      process.env.NODE_ENV === 'development' && console.log('🏢 fetchGroupDetails SKIPPED: Not authenticated or no groupId');
      return null;
    }
    
    try {
      dispatch({ type: ActionTypes.SET_GROUPS_LOADING, payload: true });
      dispatch({ type: ActionTypes.SET_GROUPS_ERROR, payload: null });
      
      // Clear current group first if switching to a different group
      if (state.groups.currentGroup && state.groups.currentGroup.id !== groupId) {
        process.env.NODE_ENV === 'development' && console.log(`🏢 Switching from group ${state.groups.currentGroup.id} to ${groupId}, clearing current group`);
        dispatch({ type: ActionTypes.SET_CURRENT_GROUP, payload: null });
        dispatch({ type: ActionTypes.SET_GROUP_MEMBERS, payload: [] });
      }
      
      process.env.NODE_ENV === 'development' && console.log('🏢 Calling groupsApi.getGroupById for groupId:', groupId);
      const response = await groupsApi.getGroupById(groupId);
      process.env.NODE_ENV === 'development' && console.log('🏢 Group details API response:', response);
      
      if (response.status === 'success') {
        process.env.NODE_ENV === 'development' && console.log('🏢 Dispatching SET_CURRENT_GROUP with data:', response.data);
        dispatch({ type: ActionTypes.SET_CURRENT_GROUP, payload: response.data });
        dispatch({ type: ActionTypes.SET_GROUPS_LOADING, payload: false });
        process.env.NODE_ENV === 'development' && console.log('🏢 fetchGroupDetails SUCCESS - returning data');
        return response.data;
      } else {
        process.env.NODE_ENV === 'development' && console.error('🏢 Group details API returned error status:', response);
        throw new Error(response.message || 'Failed to fetch group details');
      }
    } catch (err) {
      process.env.NODE_ENV === 'development' && console.error('🏢 fetchGroupDetails ERROR:', err);
      dispatch({ type: ActionTypes.SET_GROUPS_ERROR, payload: err.message || 'Failed to fetch group details' });
      showError(err.message || 'Failed to fetch group details');
      return null;
    }
  }, [state.auth.isAuthenticated, state.groups.currentGroup, showError]);

  const fetchGroupMembers = useCallback(async (groupId) => {
    process.env.NODE_ENV === 'development' && console.log('👥 fetchGroupMembers START:', { 
      groupId, 
      isAuthenticated: state.auth.isAuthenticated 
    });
    
    if (!state.auth.isAuthenticated || !groupId) {
      process.env.NODE_ENV === 'development' && console.log('👥 fetchGroupMembers SKIPPED: Not authenticated or no groupId');
      return [];
    }
    
    try {
      // Always fetch fresh data, don't use cached members for different groups
      process.env.NODE_ENV === 'development' && console.log('👥 Calling groupsApi.getGroupMembers for groupId:', groupId);
      const response = await groupsApi.getGroupMembers(groupId);
      process.env.NODE_ENV === 'development' && console.log('👥 Group members API response:', response);
      
      if (response.status === 'success') {
        process.env.NODE_ENV === 'development' && console.log(`👥 Fetched ${response.data?.length || 0} members for group ${groupId}`);
        process.env.NODE_ENV === 'development' && console.log('👥 Dispatching SET_GROUP_MEMBERS with data:', response.data);
        dispatch({ type: ActionTypes.SET_GROUP_MEMBERS, payload: response.data });
        process.env.NODE_ENV === 'development' && console.log('👥 fetchGroupMembers SUCCESS - returning data');
        return response.data;
      } else {
        process.env.NODE_ENV === 'development' && console.error('👥 Group members API returned error status:', response);
        throw new Error(response.message || 'Failed to fetch group members');
      }
    } catch (err) {
      process.env.NODE_ENV === 'development' && console.error(`👥 fetchGroupMembers ERROR for group ${groupId}:`, err);
      dispatch({ type: ActionTypes.SET_GROUPS_ERROR, payload: err.message || 'Failed to fetch group members' });
      showError(err.message || 'Failed to fetch group members');
      return [];
    }
  }, [state.auth.isAuthenticated, showError]);

  const createGroup = useCallback(async (groupData) => {
    if (!state.auth.isAuthenticated) return null;
    
    try {
      dispatch({ type: ActionTypes.SET_GROUPS_LOADING, payload: true });
      dispatch({ type: ActionTypes.SET_GROUPS_ERROR, payload: null });
      
      process.env.NODE_ENV === 'development' && console.log('Creating group with data:', groupData);
      const response = await groupsApi.createGroup(groupData);
      process.env.NODE_ENV === 'development' && console.log('Group creation API response:', response);
      
      if (response.status === 'success') {
        await fetchUserGroups();
        showSuccess('Group created successfully');
        return response;
      } else {
        throw new Error(response.message || 'Failed to create group');
      }
    } catch (err) {
      dispatch({ type: ActionTypes.SET_GROUPS_ERROR, payload: err.message || 'Failed to create group' });
      showError(err.message || 'Failed to create group');
      return null;
    }
  }, [state.auth.isAuthenticated, fetchUserGroups, showSuccess, showError]);

  const joinGroup = useCallback(async (inviteCode) => {
    if (!state.auth.isAuthenticated) return null;
    
    try {
      dispatch({ type: ActionTypes.SET_GROUPS_LOADING, payload: true });
      dispatch({ type: ActionTypes.SET_GROUPS_ERROR, payload: null });
      
      const response = await groupsApi.joinGroup(inviteCode);
      
      if (response.status === 'success') {
        await fetchUserGroups();
        showSuccess('Successfully joined group');
        return true;
      } else {
        throw new Error(response.message || 'Failed to join group');
      }
    } catch (err) {
      dispatch({ type: ActionTypes.SET_GROUPS_ERROR, payload: err.message || 'Failed to join group' });
      showError(err.message || 'Failed to join group');
      return false;
    }
  }, [state.auth.isAuthenticated, fetchUserGroups, showSuccess, showError]);

  const manageMember = useCallback(async (groupId, userId, action) => {
    if (!state.auth.isAuthenticated || !groupId) return false;
    
    try {
      dispatch({ type: ActionTypes.SET_GROUPS_LOADING, payload: true });
      dispatch({ type: ActionTypes.SET_GROUPS_ERROR, payload: null });
      
      const response = await groupsApi.manageMember(groupId, userId, action);
      
      if (response.status === 'success') {
        await fetchGroupMembers(groupId);
        showSuccess('Member action completed successfully');
        return true;
      } else {
        throw new Error(response.message || 'Failed to perform member action');
      }
    } catch (err) {
      dispatch({ type: ActionTypes.SET_GROUPS_ERROR, payload: err.message || 'Failed to perform member action' });
      showError(err.message || 'Failed to perform member action');
      return false;
    }
  }, [state.auth.isAuthenticated, fetchGroupMembers, showSuccess, showError]);

  const regenerateInviteCode = useCallback(async (groupId) => {
    if (!state.auth.isAuthenticated || !groupId) return null;
    
    try {
      dispatch({ type: ActionTypes.SET_GROUPS_LOADING, payload: true });
      dispatch({ type: ActionTypes.SET_GROUPS_ERROR, payload: null });
      
      const response = await groupsApi.regenerateInviteCode(groupId);
      
      if (response.status === 'success') {
        await fetchGroupDetails(groupId);
        showSuccess('Invite code regenerated successfully');
        return response;
      } else {
        throw new Error(response.message || 'Failed to regenerate invite code');
      }
    } catch (err) {
      dispatch({ type: ActionTypes.SET_GROUPS_ERROR, payload: err.message || 'Failed to regenerate invite code' });
      showError(err.message || 'Failed to regenerate invite code');
      return null;
    }
  }, [state.auth.isAuthenticated, fetchGroupDetails, showSuccess, showError]);

  const fetchTeamsForLeague = useCallback(async (leagueId) => {
    if (!state.auth.isAuthenticated || !leagueId) {
      dispatch({ type: ActionTypes.SET_GROUPS_ERROR, payload: "Missing league ID or not authenticated" });
      return { status: 'error', data: [] };
    }
    
    try {
      dispatch({ type: ActionTypes.SET_GROUPS_LOADING, payload: true });
      dispatch({ type: ActionTypes.SET_GROUPS_ERROR, payload: null });
      
      process.env.NODE_ENV === 'development' && console.log('Fetching teams for league:', leagueId);
      const response = await groupsApi.fetchTeamsForLeague(leagueId);
      
      if (response && response.status === 'success') {
        dispatch({ type: ActionTypes.SET_GROUPS_LOADING, payload: false });
        return response;
      } else {
        throw new Error(response?.message || 'Failed to fetch teams');
      }
    } catch (err) {
      dispatch({ type: ActionTypes.SET_GROUPS_ERROR, payload: err.message || 'Failed to fetch teams' });
      showError(err.message || 'Failed to fetch teams');
      return { status: 'error', data: [] };
    }
  }, [state.auth.isAuthenticated, showError]);

  const isAdmin = useCallback((groupId, userId) => {
    if (!groupId || !userId) {
      process.env.NODE_ENV === 'development' && console.log('isAdmin: Missing groupId or userId', { groupId, userId });
      return false;
    }
    
    const numericGroupId = parseInt(groupId);
    const numericUserId = parseInt(userId);
    
    process.env.NODE_ENV === 'development' && console.log('isAdmin check:', { numericGroupId, numericUserId });
    
    if (state.groups.currentGroup && state.groups.currentGroup.id === numericGroupId) {
      const isCurrentGroupAdmin = state.groups.currentGroup.admin_id === numericUserId;
      process.env.NODE_ENV === 'development' && console.log('isAdmin (currentGroup):', { 
        currentGroupAdmin: state.groups.currentGroup.admin_id, 
        userId: numericUserId, 
        isAdmin: isCurrentGroupAdmin 
      });
      return isCurrentGroupAdmin;
    }
    
    const group = state.groups.userGroups.find(g => g.id === numericGroupId);
    if (!group) {
      process.env.NODE_ENV === 'development' && console.log('isAdmin: Group not found in userGroups', { numericGroupId, userGroups: state.groups.userGroups });
      return false;
    }
    
    const isGroupAdmin = group.admin_id === numericUserId;
    process.env.NODE_ENV === 'development' && console.log('isAdmin (userGroups):', { 
      groupAdmin: group.admin_id, 
      userId: numericUserId, 
      isAdmin: isGroupAdmin 
    });
    
    return isGroupAdmin;
  }, [state.groups.currentGroup, state.groups.userGroups]);

  // Matches functions
  const fetchFixtures = useCallback(async (params = {}) => {
    if (!state.auth.isAuthenticated) {
      dispatch({ type: ActionTypes.SET_FIXTURES, payload: [] });
      return [];
    }
    
    const getCacheKey = (params) => {
      const paramsKey = JSON.stringify(params || {});
      return `fixtures_${paramsKey}`;
    };
    
    const cacheKey = getCacheKey(params);
    
    const cachedData = fixturesCache.current[cacheKey];
    if (cachedData && (Date.now() - cachedData.timestamp < 300000)) {
      dispatch({ type: ActionTypes.SET_FIXTURES, payload: cachedData.data });
      return cachedData.data;
    }
    
    if (requestInProgress.current[cacheKey]) {
      return [];
    }
    
    const now = Date.now();
    const timeSinceLastRequest = now - refreshTimestamp.current;
    if (timeSinceLastRequest < 1000) {
      await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastRequest));
    }
    
    requestInProgress.current[cacheKey] = true;
    refreshTimestamp.current = Date.now();
    
    try {
      dispatch({ type: ActionTypes.SET_MATCHES_LOADING, payload: true });
      dispatch({ type: ActionTypes.SET_MATCHES_ERROR, payload: null });
      
      const response = await matchesApi.getFixtures(params);
      
      if (response && response.status === 'success') {
        const fixtureData = response.matches || response.data || [];
        
        fixturesCache.current[cacheKey] = {
          data: fixtureData,
          timestamp: Date.now()
        };
        
        dispatch({ type: ActionTypes.SET_FIXTURES, payload: fixtureData });
        return fixtureData;
      } else {
        throw new Error(response?.message || 'Failed to fetch fixtures');
      }
    } catch (err) {
      dispatch({ type: ActionTypes.SET_MATCHES_ERROR, payload: err.message || 'Failed to fetch fixtures' });
      process.env.NODE_ENV === 'development' && console.error('Error fetching fixtures:', err);
      
      if (err.code !== 429) {
        showError(err.message || 'Failed to fetch fixtures');
      }
      
      dispatch({ type: ActionTypes.SET_FIXTURES, payload: [] });
      return [];
    } finally {
      dispatch({ type: ActionTypes.SET_MATCHES_LOADING, payload: false });
      requestInProgress.current[cacheKey] = false;
    }
  }, [state.auth.isAuthenticated, showError]);

  const refreshLiveMatches = useCallback(async () => {
    if (!state.auth.isAuthenticated) return [];
    
    const now = Date.now();
    if (now - refreshTimestamp.current < 60000) {
      return state.matches.liveMatches;
    }
    
    refreshTimestamp.current = now;
    
    try {
      dispatch({ type: ActionTypes.SET_MATCHES_LOADING, payload: true });
      dispatch({ type: ActionTypes.SET_MATCHES_ERROR, payload: null });
      
      const response = await matchesApi.getLiveMatches();
      
      if (response.status === 'success') {
        dispatch({ type: ActionTypes.SET_LIVE_MATCHES, payload: response.data });
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to fetch live matches');
      }
    } catch (err) {
      dispatch({ type: ActionTypes.SET_MATCHES_ERROR, payload: err.message || 'Failed to fetch live matches' });
      return [];
    } finally {
      dispatch({ type: ActionTypes.SET_MATCHES_LOADING, payload: false });
    }
  }, [state.auth.isAuthenticated, state.matches.liveMatches]);

  const fetchMatchById = useCallback(async (matchId) => {
    if (!state.auth.isAuthenticated || !matchId) return null;
    
    if (state.matches.fixtures.length > 0) {
      const cachedMatch = state.matches.fixtures.find(match => 
        match.fixture_id === matchId || match.id === matchId
      );
      
      if (cachedMatch) {
        dispatch({ type: ActionTypes.SET_SELECTED_MATCH, payload: cachedMatch });
        return cachedMatch;
      }
    }
    
    try {
      dispatch({ type: ActionTypes.SET_MATCHES_LOADING, payload: true });
      dispatch({ type: ActionTypes.SET_MATCHES_ERROR, payload: null });
      
      const response = await matchesApi.getMatchById(matchId);
      
      if (response.status === 'success') {
        dispatch({ type: ActionTypes.SET_SELECTED_MATCH, payload: response.data });
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to fetch match details');
      }
    } catch (err) {
      dispatch({ type: ActionTypes.SET_MATCHES_ERROR, payload: err.message || 'Failed to fetch match details' });
      showError(err.message || 'Failed to fetch match details');
      return null;
    } finally {
      dispatch({ type: ActionTypes.SET_MATCHES_LOADING, payload: false });
    }
  }, [state.auth.isAuthenticated, state.matches.fixtures, showError]);

  const getUpcomingMatches = useCallback(async () => {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    
    return await fetchFixtures({
      from: today.toISOString(),
      to: nextWeek.toISOString(),
      status: 'NOT_STARTED'
    });
  }, [fetchFixtures]);

  // Predictions functions
  const fetchUserPredictions = useCallback(async (params = {}) => {
    if (!state.auth.isAuthenticated) {
      dispatch({ type: ActionTypes.SET_USER_PREDICTIONS, payload: [] });
      return [];
    }
    
    try {
      dispatch({ type: ActionTypes.SET_PREDICTIONS_LOADING, payload: true });
      dispatch({ type: ActionTypes.SET_PREDICTIONS_ERROR, payload: null });
      
      const response = await predictionsApi.getUserPredictions(params);
      
      if (response.status === 'success') {
        const predictionData = response.matches || response.data || [];
        dispatch({ type: ActionTypes.SET_USER_PREDICTIONS, payload: predictionData });
        return predictionData;
      } else {
        throw new Error(response.message || 'Failed to fetch predictions');
      }
    } catch (err) {
      dispatch({ type: ActionTypes.SET_PREDICTIONS_ERROR, payload: err.message || 'Failed to fetch predictions' });
      process.env.NODE_ENV === 'development' && console.error('Error fetching predictions:', err);
      dispatch({ type: ActionTypes.SET_USER_PREDICTIONS, payload: [] });
      return [];
    } finally {
      dispatch({ type: ActionTypes.SET_PREDICTIONS_LOADING, payload: false });
    }
  }, []);

  const fetchPrediction = useCallback(async (predictionId) => {
    if (!state.auth.isAuthenticated || !predictionId) return null;
    
    try {
      dispatch({ type: ActionTypes.SET_PREDICTIONS_LOADING, payload: true });
      dispatch({ type: ActionTypes.SET_PREDICTIONS_ERROR, payload: null });
      
      const response = await predictionsApi.getPredictionById(predictionId);
      
      if (response.status === 'success') {
        dispatch({ type: ActionTypes.SET_SELECTED_PREDICTION, payload: response.data });
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to fetch prediction');
      }
    } catch (err) {
      dispatch({ type: ActionTypes.SET_PREDICTIONS_ERROR, payload: err.message || 'Failed to fetch prediction' });
      showError(err.message || 'Failed to fetch prediction');
      return null;
    } finally {
      dispatch({ type: ActionTypes.SET_PREDICTIONS_LOADING, payload: false });
    }
  }, [state.auth.isAuthenticated, showError]);

  const createPrediction = useCallback(async (predictionData) => {
    if (!state.auth.isAuthenticated) return null;
    
    try {
      dispatch({ type: ActionTypes.SET_PREDICTIONS_LOADING, payload: true });
      dispatch({ type: ActionTypes.SET_PREDICTIONS_ERROR, payload: null });
      
      const response = await predictionsApi.createPrediction(predictionData);
      
      if (response.status === 'success') {
        await fetchUserPredictions();
        showSuccess('Prediction submitted successfully');
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to create prediction');
      }
    } catch (err) {
      dispatch({ type: ActionTypes.SET_PREDICTIONS_ERROR, payload: err.message || 'Failed to create prediction' });
      showError(err.message || 'Failed to create prediction');
      return null;
    }
  }, [state.auth.isAuthenticated, showSuccess, showError]);

  const updatePrediction = useCallback(async (predictionId, predictionData) => {
    if (!state.auth.isAuthenticated || !predictionId) return null;
    
    try {
      dispatch({ type: ActionTypes.SET_PREDICTIONS_LOADING, payload: true });
      dispatch({ type: ActionTypes.SET_PREDICTIONS_ERROR, payload: null });
      
      const response = await predictionsApi.updatePrediction(predictionId, predictionData);
      
      if (response.status === 'success') {
        await fetchUserPredictions();
        showSuccess('Prediction updated successfully');
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to update prediction');
      }
    } catch (err) {
      dispatch({ type: ActionTypes.SET_PREDICTIONS_ERROR, payload: err.message || 'Failed to update prediction' });
      showError(err.message || 'Failed to update prediction');
      return null;
    }
  }, [state.auth.isAuthenticated, showSuccess, showError]);

  const resetPrediction = useCallback(async (predictionId) => {
    if (!state.auth.isAuthenticated || !predictionId) return null;
    
    try {
      dispatch({ type: ActionTypes.SET_PREDICTIONS_LOADING, payload: true });
      dispatch({ type: ActionTypes.SET_PREDICTIONS_ERROR, payload: null });
      
      const response = await predictionsApi.resetPrediction(predictionId);
      
      if (response.status === 'success') {
        await fetchUserPredictions();
        showSuccess('Prediction reset successfully');
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to reset prediction');
      }
    } catch (err) {
      dispatch({ type: ActionTypes.SET_PREDICTIONS_ERROR, payload: err.message || 'Failed to reset prediction' });
      showError(err.message || 'Failed to reset prediction');
      return null;
    }
  }, [state.auth.isAuthenticated, showSuccess, showError]);

  const submitBatchPredictions = useCallback(async (predictions) => {
    if (!state.auth.isAuthenticated) return null;
    
    try {
      dispatch({ type: ActionTypes.SET_PREDICTIONS_LOADING, payload: true });
      dispatch({ type: ActionTypes.SET_PREDICTIONS_ERROR, payload: null });
      
      const response = await predictionsApi.createBatchPredictions(predictions);
      
      if (response.status === 'success') {
        await fetchUserPredictions();
        showSuccess('Predictions submitted successfully');
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to submit predictions');
      }
    } catch (err) {
      dispatch({ type: ActionTypes.SET_PREDICTIONS_ERROR, payload: err.message || 'Failed to submit predictions' });
      showError(err.message || 'Failed to submit predictions');
      return null;
    }
  }, [state.auth.isAuthenticated, fetchUserPredictions, showSuccess, showError]);

  // League functions
  const setSelectedSeason = useCallback((season, groupId = null) => {
    dispatch({ type: ActionTypes.SET_SELECTED_SEASON, payload: season });
    // Note: Removed the immediate fetchLeaderboard call to avoid circular dependency
    // The GroupDetailsPage will handle refreshing the leaderboard when season changes
  }, []);

  const setSelectedWeek = useCallback((week) => {
    dispatch({ type: ActionTypes.SET_SELECTED_WEEK, payload: week });
  }, []);

  const setSelectedGroup = useCallback((group) => {
    dispatch({ type: ActionTypes.SET_SELECTED_GROUP, payload: group });
  }, []);

  const fetchLeaderboard = useCallback(async (groupId, queryParams = {}) => {
    dispatch({ type: ActionTypes.SET_LEAGUE_LOADING, payload: true });
    dispatch({ type: ActionTypes.SET_LEAGUE_ERROR, payload: null });
    
    try {
      // Get group details to determine league
      const group = state.groups.currentGroup || 
                    state.groups.userGroups.find(g => g.id === parseInt(groupId));
      
      process.env.NODE_ENV === 'development' && console.log('🔍 fetchLeaderboard - Group found:', group);
      
      let enhancedParams = { ...queryParams };
      
      if (group && group.league) {
        enhancedParams.league = group.league;
        
        // If no season specified, use current season for the league
        if (!enhancedParams.season) {
          enhancedParams.season = SeasonManager.getCurrentSeason(group.league);
          
          // Update selected season in state if not set
          if (!state.league.selectedSeason) {
            process.env.NODE_ENV === 'development' && console.log('🔍 Setting selectedSeason in fetchLeaderboard:', enhancedParams.season);
            dispatch({ 
              type: ActionTypes.SET_SELECTED_SEASON, 
              payload: enhancedParams.season 
            });
          }
        }
      } else {
        process.env.NODE_ENV === 'development' && console.warn('🔍 No group or league found for groupId:', groupId);
      }
      
      process.env.NODE_ENV === 'development' && console.log('🔍 Fetching leaderboard with enhanced params:', enhancedParams);
      
      const response = await predictionsApi.getGroupLeaderboard(groupId, enhancedParams);
      process.env.NODE_ENV === 'development' && console.log('🔍 Leaderboard response:', response);
      dispatch({ type: ActionTypes.SET_LEADERBOARD, payload: response.data || [] });
      return response.data;
    } catch (error) {
      process.env.NODE_ENV === 'development' && console.error('🔍 Error fetching leaderboard:', error);
      const errorMessage = error.message || 'Failed to load leaderboard';
      dispatch({ type: ActionTypes.SET_LEAGUE_ERROR, payload: errorMessage });
      showError(errorMessage);
      dispatch({ type: ActionTypes.SET_LEADERBOARD, payload: [] });
      return [];
    } finally {
      dispatch({ type: ActionTypes.SET_LEAGUE_LOADING, payload: false });
    }
  }, [state.groups.currentGroup, state.groups.userGroups, state.league.selectedSeason, showError]);

  // NEW: Function to fetch available seasons for a group
  const fetchGroupSeasons = useCallback(async (groupId) => {
    try {
      const group = state.groups.currentGroup || 
                    state.groups.userGroups.find(g => g.id === parseInt(groupId));
      
      let seasons = [];
      
      if (group && group.league) {
        // Use local season manager for immediate response
        seasons = SeasonManager.getAvailableSeasons(group.league, 5);
        
        // Also try to fetch from backend for validation
        try {
          const response = await predictionsApi.getGroupSeasons(groupId);
          if (response.status === 'success' && response.data.length > 0) {
            seasons = response.data;
          }
        } catch (backendError) {
          process.env.NODE_ENV === 'development' && console.warn('Backend season fetch failed, using local seasons:', backendError);
        }
      }
      
      dispatch({ 
        type: ActionTypes.SET_AVAILABLE_SEASONS, 
        payload: seasons 
      });
      
      return seasons;
    } catch (error) {
      process.env.NODE_ENV === 'development' && console.error('Error fetching group seasons:', error);
      return [];
    }
  }, [state.groups.currentGroup, state.groups.userGroups]);

  // Clear functions
  const clearPredictionData = useCallback(() => {
    dispatch({ type: ActionTypes.CLEAR_PREDICTIONS_DATA });
  }, []);

  const clearMatchData = useCallback(() => {
    dispatch({ type: ActionTypes.CLEAR_MATCHES_DATA });
    fixturesCache.current = {};
  }, []);

  const clearGroupData = useCallback(() => {
    process.env.NODE_ENV === 'development' && console.log('Clearing all group data');
    dispatch({ type: ActionTypes.CLEAR_GROUPS_DATA });
  }, []);

  const clearUserData = useCallback(() => {
    dispatch({ type: ActionTypes.CLEAR_USER_DATA });
  }, []);

  const clearLeagueData = useCallback(() => {
    dispatch({ type: ActionTypes.CLEAR_LEAGUE_DATA });
  }, []);

  // 1. Add new group management functions
  const updateGroup = useCallback(async (groupId, groupData) => {
    if (!state.auth.isAuthenticated || !groupId) return null;
    
    try {
      dispatch({ type: ActionTypes.SET_GROUPS_LOADING, payload: true });
      dispatch({ type: ActionTypes.SET_GROUPS_ERROR, payload: null });
      
      const response = await groupsApi.updateGroup(groupId, groupData);
      
      if (response.status === 'success') {
        await fetchGroupDetails(groupId);
        showSuccess('Group updated successfully');
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to update group');
      }
    } catch (err) {
      dispatch({ type: ActionTypes.SET_GROUPS_ERROR, payload: err.message || 'Failed to update group' });
      showError(err.message || 'Failed to update group');
      return null;
    }
  }, [state.auth.isAuthenticated, fetchGroupDetails, showSuccess, showError]);

  const leaveGroup = useCallback(async (groupId) => {
    if (!state.auth.isAuthenticated || !groupId) return false;
    
    try {
      dispatch({ type: ActionTypes.SET_GROUPS_LOADING, payload: true });
      dispatch({ type: ActionTypes.SET_GROUPS_ERROR, payload: null });
      
      const response = await groupsApi.leaveGroup(groupId);
      
      if (response.status === 'success') {
        await fetchUserGroups();
        showSuccess('Successfully left group');
        return true;
      } else {
        throw new Error(response.message || 'Failed to leave group');
      }
    } catch (err) {
      dispatch({ type: ActionTypes.SET_GROUPS_ERROR, payload: err.message || 'Failed to leave group' });
      showError(err.message || 'Failed to leave group');
      return false;
    }
  }, [state.auth.isAuthenticated, fetchUserGroups, showSuccess, showError]);

  // 2. Add new membership check function
  const isMember = useCallback((groupId) => {
    if (!groupId) return false;
    return state.groups.userGroups.some(g => g.id === groupId);
  }, [state.groups.userGroups]);

  // Add getUserStats to the AppProvider component
  const getUserStats = useCallback(async (userId) => {
    try {
      dispatch({ type: ActionTypes.SET_USER_STATS_LOADING, payload: true });
      dispatch({ type: ActionTypes.SET_USER_ERROR, payload: null });
      
      const response = await usersApi.getUserStats(userId);
      
      if (response.status === 'success') {
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to fetch user stats');
      }
    } catch (err) {
      dispatch({ type: ActionTypes.SET_USER_ERROR, payload: err.message || 'Failed to fetch user stats' });
      return null;
    } finally {
      dispatch({ type: ActionTypes.SET_USER_STATS_LOADING, payload: false });
    }
  }, []);

  // Context value - memoized to prevent infinite re-renders
  const contextValue = useMemo(() => ({
    // Auth
    user: state.auth.user,
    isAuthenticated: state.auth.isAuthenticated,
    authLoading: state.auth.loading,
    authError: state.auth.error,
    login,
    register,
    logout,
    checkAuth,
    clearAuthError,

    // User
    profile: state.user.profile,
    stats: state.user.stats,
    userLoading: state.user.loading,
    userError: state.user.error,
    statsLoading: state.user.statsLoading,
    statsError: state.user.statsError,
    fetchProfile,
    updateProfile,
    clearUserData,
    getUserStats,

    // Groups
    userGroups: state.groups.userGroups,
    currentGroup: state.groups.currentGroup,
    groupMembers: state.groups.groupMembers,
    groupsLoading: state.groups.loading,
    groupsError: state.groups.error,
    fetchUserGroups,
    fetchGroupDetails,
    fetchGroupMembers,
    createGroup,
    joinGroup,
    manageMember,
    regenerateInviteCode,
    fetchTeamsForLeague,
    isAdmin,
    clearGroupData,
    setCurrentGroup: (group) => dispatch({ type: ActionTypes.SET_CURRENT_GROUP, payload: group }),
    updateGroup,
    leaveGroup,
    isMember,

    // Matches
    fixtures: state.matches.fixtures,
    liveMatches: state.matches.liveMatches,
    selectedMatch: state.matches.selectedMatch,
    matchesLoading: state.matches.loading,
    matchesError: state.matches.error,
    fetchFixtures,
    refreshLiveMatches,
    fetchMatchById,
    getUpcomingMatches,
    clearMatchData,

    // Predictions
    userPredictions: state.predictions.userPredictions,
    selectedPrediction: state.predictions.selectedPrediction,
    predictionsLoading: state.predictions.loading,
    predictionsError: state.predictions.error,
    fetchUserPredictions,
    fetchPrediction,
    createPrediction,
    updatePrediction,
    resetPrediction,
    submitBatchPredictions,
    clearPredictionData,

    // Notifications
    notifications: state.notifications.notifications,
    addNotification,
    removeNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    clearAllNotifications,

    // League
    selectedSeason: state.league.selectedSeason,
    selectedWeek: state.league.selectedWeek,
    selectedGroup: state.league.selectedGroup,
    leaderboard: state.league.leaderboard,
    availableSeasons: state.league.availableSeasons,
    leagueLoading: state.league.loading,
    leagueError: state.league.error,
    setSelectedSeason,
    setSelectedWeek,
    setSelectedGroup,
    fetchLeaderboard,
    fetchGroupSeasons,
    clearLeagueData,
    
    // Season management utilities
    normalizeSeasonForQuery: (league, season) => SeasonManager.normalizeSeasonForQuery(league, season),
    getSeasonForDisplay: (league, season) => SeasonManager.getSeasonForDisplay(league, season),
    getCurrentSeason: (league) => SeasonManager.getCurrentSeason(league),

    // New getUserStats function
    getUserStats,
  }), [
    // Auth dependencies
    state.auth.user,
    state.auth.isAuthenticated,
    state.auth.loading,
    state.auth.error,
    login,
    register,
    logout,
    checkAuth,
    clearAuthError,
    
    // User dependencies
    state.user.profile,
    state.user.stats,
    state.user.loading,
    state.user.error,
    state.user.statsLoading,
    state.user.statsError,
    fetchProfile,
    updateProfile,
    clearUserData,
    getUserStats,
    
    // Groups dependencies
    state.groups.userGroups,
    state.groups.currentGroup,
    state.groups.groupMembers,
    state.groups.loading,
    state.groups.error,
    fetchUserGroups,
    fetchGroupDetails,
    fetchGroupMembers,
    createGroup,
    joinGroup,
    manageMember,
    regenerateInviteCode,
    fetchTeamsForLeague,
    isAdmin,
    clearGroupData,
    updateGroup,
    leaveGroup,
    isMember,
    
    // Matches dependencies
    state.matches.fixtures,
    state.matches.liveMatches,
    state.matches.selectedMatch,
    state.matches.loading,
    state.matches.error,
    fetchFixtures,
    refreshLiveMatches,
    fetchMatchById,
    getUpcomingMatches,
    clearMatchData,
    
    // Predictions dependencies
    state.predictions.userPredictions,
    state.predictions.selectedPrediction,
    state.predictions.loading,
    state.predictions.error,
    fetchUserPredictions,
    fetchPrediction,
    createPrediction,
    updatePrediction,
    resetPrediction,
    submitBatchPredictions,
    clearPredictionData,
    
    // Notifications dependencies
    state.notifications.notifications,
    addNotification,
    removeNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    clearAllNotifications,
    
    // League dependencies
    state.league.selectedSeason,
    state.league.selectedWeek,
    state.league.selectedGroup,
    state.league.leaderboard,
    state.league.loading,
    state.league.error,
    state.league.availableSeasons,
    setSelectedSeason,
    setSelectedWeek,
    setSelectedGroup,
    fetchLeaderboard,
    clearLeagueData,
    
    // Season management dependencies
    normalizeSeasonForQuery,
    getSeasonForDisplay,
    getCurrentSeason
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

// Export the GroupDetailsProvider component
export const GroupDetailsProvider = ({ groupId, children }) => {
  const {
    fetchGroupDetails,
    fetchGroupMembers,
    profile
  } = useContext(AppContext);
  
  useEffect(() => {
    if (groupId && profile) {
      fetchGroupDetails(parseInt(groupId));
      fetchGroupMembers(parseInt(groupId));
    }
  }, [groupId, profile, fetchGroupDetails, fetchGroupMembers]);

  return children;
};

// Custom hooks for each domain
export const useAuth = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAuth must be used within an AppProvider');
  }
  
  return {
    user: context.user,
    loading: context.authLoading,
    error: context.authError,
    isAuthenticated: context.isAuthenticated,
    login: context.login,
    register: context.register,
    logout: context.logout,
    checkAuth: context.checkAuth,
    clearError: context.clearAuthError
  };
};

export const useUser = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useUser must be used within an AppProvider');
  }
  
  return {
    profile: context.profile,
    stats: context.stats,
    loading: context.userLoading,
    error: context.userError,
    statsLoading: context.statsLoading,
    statsError: context.statsError,
    fetchProfile: context.fetchProfile,
    updateProfile: context.updateProfile,
    clearUserData: context.clearUserData,
    getUserStats: context.getUserStats,
  };
};

export const useGroups = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useGroups must be used within an AppProvider');
  }
  
  return {
    userGroups: context.userGroups,
    currentGroup: context.currentGroup,
    groupMembers: context.groupMembers,
    loading: context.groupsLoading,
    error: context.groupsError,
    fetchUserGroups: context.fetchUserGroups,
    fetchGroupDetails: context.fetchGroupDetails,
    fetchGroupMembers: context.fetchGroupMembers,
    createGroup: context.createGroup,
    joinGroup: context.joinGroup,
    manageMember: context.manageMember,
    regenerateInviteCode: context.regenerateInviteCode,
    fetchTeamsForLeague: context.fetchTeamsForLeague,
    isAdmin: context.isAdmin,
    clearGroupData: context.clearGroupData,
    setCurrentGroup: context.setCurrentGroup,
    updateGroup: context.updateGroup,
    leaveGroup: context.leaveGroup,
    isMember: context.isMember
  };
};

export const useMatches = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useMatches must be used within an AppProvider');
  }
  
  return {
    fixtures: context.fixtures,
    liveMatches: context.liveMatches,
    selectedMatch: context.selectedMatch,
    loading: context.matchesLoading,
    error: context.matchesError,
    fetchFixtures: context.fetchFixtures,
    refreshLiveMatches: context.refreshLiveMatches,
    fetchMatchById: context.fetchMatchById,
    getUpcomingMatches: context.getUpcomingMatches,
    clearMatchData: context.clearMatchData,
    fetchUpcomingMatches: context.getUpcomingMatches,
  };
};

export const usePredictions = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('usePredictions must be used within an AppProvider');
  }
  
  return {
    userPredictions: context.userPredictions,
    selectedPrediction: context.selectedPrediction,
    loading: context.predictionsLoading,
    error: context.predictionsError,
    fetchUserPredictions: context.fetchUserPredictions,
    fetchPrediction: context.fetchPrediction,
    createPrediction: context.createPrediction,
    updatePrediction: context.updatePrediction,
    resetPrediction: context.resetPrediction,
    submitBatchPredictions: context.submitBatchPredictions,
    clearPredictionData: context.clearPredictionData,
    createBatchPredictions: context.submitBatchPredictions,
  };
};

export const useNotifications = () => {
  const context = useContext(AppContext);
  if (!context) {
    // Return default implementation instead of throwing error
    return {
      notifications: [],
      addNotification: () => {},
      removeNotification: () => {},
      showSuccess: () => {},
      showError: () => {},
      showWarning: () => {},
      showInfo: () => {},
      clearAllNotifications: () => {}
    };
  }
  
  return {
    notifications: context.notifications,
    addNotification: context.addNotification,
    removeNotification: context.removeNotification,
    showSuccess: context.showSuccess,
    showError: context.showError,
    showWarning: context.showWarning,
    showInfo: context.showInfo,
    clearAllNotifications: context.clearAllNotifications
  };
};

export const useLeagueContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useLeagueContext must be used within an AppProvider');
  }
  
  return {
    // FIXED: Access properties directly from context (they're already flattened)
    selectedSeason: context.selectedSeason,
    selectedWeek: context.selectedWeek,
    selectedGroup: context.selectedGroup,
    leaderboard: context.leaderboard,
    loading: context.leagueLoading,
    error: context.leagueError,
    setSelectedSeason: context.setSelectedSeason,
    setSelectedWeek: context.setSelectedWeek,
    setSelectedGroup: context.setSelectedGroup,
    fetchLeaderboard: context.fetchLeaderboard,
    fetchTeams: context.fetchTeamsForLeague
  };
};

export const useGroupDetails = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useGroupDetails must be used within an AppProvider');
  }
  
  return {
    selectedSeason: context.selectedSeason,
    selectedWeek: context.selectedWeek,
    setSelectedSeason: context.setSelectedSeason,
    setSelectedWeek: context.setSelectedWeek,
    members: context.groupMembers,
    loading: context.groupsLoading,
    error: context.groupsError,
    group: context.currentGroup
  };
};

export default AppContext;