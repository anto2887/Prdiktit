// src/pages/RivalryPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AppContext';
import RivalryDashboard from '../components/rivalries/RivalryDashboard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import SeasonManager from '../utils/seasonManager';

const RivalryPage = () => {
  const { groupId } = useParams();
  const { user, loading } = useAuth();
  const [currentSeason, setCurrentSeason] = useState('');
  
  // Show loading while auth is being checked
  if (loading) {
    return <LoadingSpinner />;
  }
  
  // Redirect if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  // Show error if no groupId provided
  if (!groupId) {
    return <ErrorMessage message="Group ID is required" />;
  }

  // Get current season dynamically
  useEffect(() => {
    try {
      // Default to Premier League if no group context available
      const season = SeasonManager.getCurrentSeason('Premier League');
      setCurrentSeason(season);
    } catch (error) {
      console.error('Error getting current season:', error);
      // Fallback to hardcoded season
      setCurrentSeason('2025-2026');
    }
  }, []);
  
  // Get current week from user's season data or default to current week
  const getCurrentWeek = () => {
    // This should be fetched from the user's season data
    // For now, we'll use a default or get it from localStorage
    const storedWeek = localStorage.getItem('currentWeek');
    if (storedWeek) {
      return parseInt(storedWeek, 10);
    }
    
    // Fallback: calculate current week based on season start
    const seasonStart = new Date('2025-08-17'); // Premier League 2025-26 start
    const now = new Date();
    const weeksSinceStart = Math.floor((now - seasonStart) / (7 * 24 * 60 * 60 * 1000));
    return Math.max(1, Math.min(38, weeksSinceStart + 1)); // Between 1-38 weeks
  };
  
  const currentWeek = getCurrentWeek();
  
  return (
    <RivalryDashboard 
      groupId={groupId}
      currentWeek={currentWeek}
      season={currentSeason}
    />
  );
};

export default RivalryPage; 