// src/pages/RivalryPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useAuth, useGroups } from '../contexts/AppContext';
import RivalryDashboard from '../components/rivalries/RivalryDashboard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import SeasonManager from '../utils/seasonManager';

const RivalryPage = () => {
  const { groupId } = useParams();
  const { user, loading } = useAuth();
  const { currentGroup, fetchGroupDetails, loading: groupsLoading } = useGroups();
  const [currentSeason, setCurrentSeason] = useState('');
  const numericGroupId = parseInt(groupId, 10);
  const pageGroup = currentGroup?.id === numericGroupId ? currentGroup : null;
  
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

  useEffect(() => {
    if (groupId) {
      fetchGroupDetails(groupId);
    }
  }, [groupId, fetchGroupDetails]);

  // Get current season dynamically
  useEffect(() => {
    try {
      const league = pageGroup?.league || 'Premier League';
      const season = SeasonManager.getCurrentSeason(league);
      setCurrentSeason(season);
    } catch (error) {
      console.error('Error getting current season:', error);
      // Fallback to hardcoded season
      setCurrentSeason('2025-2026');
    }
  }, [pageGroup?.league]);

  if (groupsLoading && !pageGroup) {
    return <LoadingSpinner />;
  }
  
  return (
    <RivalryDashboard 
      groupId={groupId}
      currentWeek={pageGroup?.current_week || 1}
      season={currentSeason}
      group={pageGroup}
    />
  );
};

export default RivalryPage; 