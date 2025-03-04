// src/pages/DashboardPage.jsx
import React, { useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { usePredictions } from '../contexts/PredictionContext';
import { useGroups } from '../contexts/GroupContext';
import { useMatches } from '../contexts/MatchContext';

// Components
import Dashboard from '../components/dashboard/Dashboard';
import DashboardStats from '../components/dashboard/DashboardStats';
import RecentPredictions from '../components/dashboard/RecentPredictions';
import UpcomingMatches from '../components/dashboard/UpcomingMatches';
import LiveMatches from '../components/dashboard/LiveMatches';
import LeagueTable from '../components/dashboard/LeagueTable';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';

const DashboardPage = () => {
  const { profile, stats, loading: userLoading, error: userError } = useUser();
  const { userPredictions, fetchUserPredictions, loading: predictionsLoading, error: predictionsError } = usePredictions();
  const { liveMatches, fixtures, refreshLiveMatches, fetchFixtures, loading: matchesLoading, error: matchesError } = useMatches();
  const { userGroups, fetchUserGroups, loading: groupsLoading, error: groupsError } = useGroups();

  // Combined loading and error states
  const isLoading = userLoading || predictionsLoading || matchesLoading || groupsLoading;
  const errors = [userError, predictionsError, matchesError, groupsError].filter(Boolean);
  
  useEffect(() => {
    // Fetch initial data
    fetchUserPredictions();
    fetchUserGroups();
    
    // Fetch live matches and upcoming fixtures
    refreshLiveMatches();
    
    // Get upcoming matches for next 7 days
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    
    fetchFixtures({
      from: today.toISOString(),
      to: nextWeek.toISOString(),
      status: 'NOT_STARTED'
    });
    
    // Set up polling for live matches
    const interval = setInterval(() => {
      refreshLiveMatches();
    }, 60000); // Every minute
    
    return () => clearInterval(interval);
  }, [fetchUserPredictions, fetchUserGroups, refreshLiveMatches, fetchFixtures]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (errors.length > 0) {
    return <ErrorMessage message={errors[0]} />;
  }

  return <Dashboard />;
};

export default DashboardPage;