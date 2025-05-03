// src/contexts/MatchContext.js
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { matchesApi } from '../api';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';

const MatchContext = createContext(null);

export const MatchProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { showError } = useNotifications();
  
  const [fixtures, setFixtures] = useState([]);
  const [liveMatches, setLiveMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Add cache to prevent duplicate requests
  const fixturesCache = useRef({});
  const requestInProgress = useRef({});
  const refreshTimestamp = useRef(0);
  
  // Function to generate a cache key
  const getCacheKey = (params) => {
    const paramsKey = JSON.stringify(params || {});
    return `fixtures_${paramsKey}`;
  };
  
  // Debounced fetch function
  const fetchFixtures = useCallback(async (params = {}) => {
    if (!isAuthenticated) {
      setFixtures([]);
      return [];
    }
    
    // Generate cache key from params
    const cacheKey = getCacheKey(params);
    
    // Check if we have a valid cache entry
    const cachedData = fixturesCache.current[cacheKey];
    if (cachedData && (Date.now() - cachedData.timestamp < 300000)) { // Cache for 5 minutes
      setFixtures(cachedData.data);
      return cachedData.data;
    }
    
    // Check if this exact request is already in progress
    if (requestInProgress.current[cacheKey]) {
      return [];
    }
    
    // Throttle requests - no more than 1 request per second
    const now = Date.now();
    const timeSinceLastRequest = now - refreshTimestamp.current;
    if (timeSinceLastRequest < 1000) {
      await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastRequest));
    }
    
    // Mark request as in progress
    requestInProgress.current[cacheKey] = true;
    refreshTimestamp.current = Date.now();
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await matchesApi.getFixtures(params);
      
      if (response && response.status === 'success') {
        // Check for both response.data and response.matches formats
        const fixtureData = response.matches || response.data || [];
        
        // Cache the result
        fixturesCache.current[cacheKey] = {
          data: fixtureData,
          timestamp: Date.now()
        };
        
        setFixtures(fixtureData);
        return fixtureData;
      } else {
        throw new Error(response?.message || 'Failed to fetch fixtures');
      }
    } catch (err) {
      // Don't show error for every component that calls this
      setError(err.message || 'Failed to fetch fixtures');
      console.error('Error fetching fixtures:', err);
      
      // Only show user-visible error for severe issues
      if (err.code !== 429) { // Don't show rate limit errors
        showError(err.message || 'Failed to fetch fixtures');
      }
      
      // Set empty array to prevent undefined issues
      setFixtures([]);
      return [];
    } finally {
      setLoading(false);
      // Remove request in progress flag
      requestInProgress.current[cacheKey] = false;
    }
  }, [isAuthenticated, showError]);

  // Optimized live matches polling
  const refreshLiveMatches = useCallback(async () => {
    if (!isAuthenticated) return [];
    
    // Don't refresh too frequently - limit to once per minute
    const now = Date.now();
    if (now - refreshTimestamp.current < 60000) {
      return liveMatches; // Return cached data
    }
    
    refreshTimestamp.current = now;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await matchesApi.getLiveMatches();
      
      if (response.status === 'success') {
        setLiveMatches(response.data);
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to fetch live matches');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch live matches');
      // Don't show error for live matches polling
      return [];
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, liveMatches]);

  const fetchMatchById = useCallback(async (matchId) => {
    if (!isAuthenticated || !matchId) return null;
    
    // Check cache first - if we have fixtures
    if (fixtures.length > 0) {
      const cachedMatch = fixtures.find(match => 
        match.fixture_id === matchId || match.id === matchId
      );
      
      if (cachedMatch) {
        setSelectedMatch(cachedMatch);
        return cachedMatch;
      }
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await matchesApi.getMatchById(matchId);
      
      if (response.status === 'success') {
        setSelectedMatch(response.data);
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to fetch match details');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch match details');
      showError(err.message || 'Failed to fetch match details');
      return null;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, fixtures, showError]);

  const getUpcomingMatches = useCallback(async () => {
    // Use fetchFixtures with upcoming matches params 
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    
    return await fetchFixtures({
      from: today.toISOString(),
      to: nextWeek.toISOString(),
      status: 'NOT_STARTED'
    });
  }, [fetchFixtures]);

  const clearMatchData = useCallback(() => {
    setFixtures([]);
    setLiveMatches([]);
    setSelectedMatch(null);
    setError(null);
    fixturesCache.current = {};
  }, []);

  return (
    <MatchContext.Provider
      value={{
        fixtures,
        liveMatches,
        selectedMatch,
        loading,
        error,
        fetchFixtures,
        refreshLiveMatches,
        fetchMatchById,
        getUpcomingMatches,
        clearMatchData
      }}
    >
      {children}
    </MatchContext.Provider>
  );
};

export const useMatches = () => {
  const context = useContext(MatchContext);
  if (!context) {
    throw new Error('useMatches must be used within a MatchProvider');
  }
  return context;
};

export default MatchContext;