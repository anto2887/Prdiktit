// src/contexts/MatchContext.js
import React, { createContext, useContext, useState, useCallback } from 'react';
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

  const fetchFixtures = useCallback(async (params = {}) => {
    if (!isAuthenticated) return [];
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await matchesApi.getFixtures(params);
      
      if (response.status === 'success') {
        setFixtures(response.data);
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to fetch fixtures');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch fixtures');
      showError(err.message || 'Failed to fetch fixtures');
      return [];
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, showError]);

  const refreshLiveMatches = useCallback(async () => {
    if (!isAuthenticated) return [];
    
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
  }, [isAuthenticated, showError]);

  const fetchMatchById = useCallback(async (matchId) => {
    if (!isAuthenticated || !matchId) return null;
    
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
  }, [isAuthenticated, showError]);

  const getUpcomingMatches = useCallback(async () => {
    if (!isAuthenticated) return [];
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await matchesApi.getUpcomingMatches();
      
      if (response.status === 'success') {
        return response.matches || [];
      } else {
        throw new Error(response.message || 'Failed to fetch upcoming matches');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch upcoming matches');
      showError(err.message || 'Failed to fetch upcoming matches');
      return [];
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, showError]);

  const clearMatchData = useCallback(() => {
    setFixtures([]);
    setLiveMatches([]);
    setSelectedMatch(null);
    setError(null);
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