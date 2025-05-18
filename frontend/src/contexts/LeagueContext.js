// src/contexts/LeagueContext.js
import React, { createContext, useContext, useState, useCallback } from 'react';
import { predictionsApi } from '../api';
import { useNotifications } from './NotificationContext';

// Initialize context with default values
const LeagueContext = createContext({
  selectedGroup: null,
  selectedSeason: '2024-2025',
  selectedWeek: null,
  leaderboard: [],
  loading: false,
  error: null,
  setSelectedGroup: () => {},
  setSelectedSeason: () => {},
  setSelectedWeek: () => {},
  fetchLeaderboard: async () => []
});

export const LeagueProvider = ({ children }) => {
  console.log("Initializing LeagueProvider");
  
  const { showError } = useNotifications();
  
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedSeason, setSelectedSeason] = useState('2024-2025');
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchLeaderboard = useCallback(async (groupId, params = {}) => {
    if (!groupId) return [];
    
    try {
      setLoading(true);
      setError(null);
      
      const season = params.season || selectedSeason;
      const week = params.week || selectedWeek;
      
      const queryParams = {
        season: season
      };
      
      if (week) {
        queryParams.week = week;
      }
      
      // Call the API if it's implemented
      if (predictionsApi.getGroupLeaderboard) {
        const response = await predictionsApi.getGroupLeaderboard(groupId, queryParams);
        
        if (response.status === 'success') {
          setLeaderboard(response.data || []);
          return response.data;
        } else {
          throw new Error(response.message || 'Failed to fetch leaderboard');
        }
      } else {
        // Return empty array if API not implemented yet
        setLeaderboard([]);
        return [];
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch leaderboard');
      showError(err.message || 'Failed to fetch leaderboard');
      return [];
    } finally {
      setLoading(false);
    }
  }, [selectedSeason, selectedWeek, showError]);

  const contextValue = {
    selectedGroup,
    selectedSeason,
    selectedWeek,
    leaderboard,
    loading,
    error,
    setSelectedGroup,
    setSelectedSeason,
    setSelectedWeek,
    fetchLeaderboard
  };

  return (
    <LeagueContext.Provider value={contextValue}>
      {children}
    </LeagueContext.Provider>
  );
};

export const useLeagueContext = () => {
  return useContext(LeagueContext);
};

export default LeagueContext;