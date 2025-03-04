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

  // Instead of just returning the Dashboard component, let's return a layout
  // that includes all the dashboard components
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      
      {/* Stats section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Your Stats</h2>
        <DashboardStats stats={stats} />
      </section>
      
      {/* Live matches section */}
      {liveMatches && liveMatches.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Live Matches</h2>
          <LiveMatches matches={liveMatches} />
        </section>
      )}
      
      {/* Upcoming matches section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Upcoming Matches</h2>
        <UpcomingMatches matches={fixtures} />
      </section>
      
      {/* Recent predictions section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Your Recent Predictions</h2>
        <RecentPredictions predictions={userPredictions} />
      </section>
      
      {/* League table section */}
      {userGroups && userGroups.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Your Groups</h2>
          <LeagueTable groups={userGroups} />
        </section>
      )}
    </div>
  );
};

export default DashboardPage;