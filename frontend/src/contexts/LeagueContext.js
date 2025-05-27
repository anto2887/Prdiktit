// src/contexts/LeagueContext.js
import React, { createContext, useContext, useState, useCallback } from 'react';
import { predictionsApi, groupsApi } from '../api';
import { useNotifications } from './NotificationContext';

// Initialize context with default values
const LeagueContext = createContext({
  selectedSeason: null,
  selectedWeek: null,
  leaderboard: [],
  loading: false,
  error: null,
  setSelectedSeason: () => {},
  setSelectedWeek: () => {},
  fetchLeaderboard: () => Promise.resolve([])
});

export const LeagueProvider = ({ children }) => {
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { showError } = useNotifications();

  const fetchLeaderboard = useCallback(async (groupId, queryParams = {}) => {
    setLoading(true);
    setError(null);
    try {
      // Use the predictionsApi for leaderboard
      const response = await predictionsApi.getGroupLeaderboard(groupId, queryParams);
      setLeaderboard(response.data || []);
      return response.data;
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      setError(error.message);
      showError(error.message);
      setLeaderboard([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const fetchTeams = useCallback(async (leagueId) => {
    try {
      // Use the groupsApi for fetching teams
      const response = await groupsApi.fetchTeamsForLeague(leagueId);
      return response.data || [];
    } catch (error) {
      console.error('Error fetching teams:', error);
      showError(error.message);
      return [];
    }
  }, [showError]);

  const value = {
    selectedSeason,
    selectedWeek,
    leaderboard,
    loading,
    error,
    setSelectedSeason,
    setSelectedWeek,
    fetchLeaderboard,
    fetchTeams
  };

  return (
    <LeagueContext.Provider value={value}>
      {children}
    </LeagueContext.Provider>
  );
};

export const useLeagueContext = () => {
  return useContext(LeagueContext);
};

export default LeagueContext;