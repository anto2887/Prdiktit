// src/pages/DashboardPage.jsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { usePredictions } from '../contexts/PredictionContext';
import { useGroups } from '../contexts/GroupContext';
import { useMatches } from '../contexts/MatchContext';
import { useLeagueContext } from '../contexts/LeagueContext';

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
  const { profile, stats, fetchProfile, loading: userLoading, error: userError } = useUser();
  const { userPredictions, fetchUserPredictions, loading: predictionsLoading, error: predictionsError } = usePredictions();
  const { liveMatches, fixtures, refreshLiveMatches, fetchFixtures, loading: matchesLoading, error: matchesError } = useMatches();
  const { userGroups, fetchUserGroups, loading: groupsLoading, error: groupsError } = useGroups();
  const { selectedGroup, setSelectedGroup } = useLeagueContext();

  const [retryCount, setRetryCount] = useState(0);
  const [dataFetchStatus, setDataFetchStatus] = useState({
    profile: false,
    predictions: false,
    groups: false,
    matches: false,
    fixtures: false
  });

  // Combined loading and error states
  const isLoading = userLoading || predictionsLoading || matchesLoading || groupsLoading;
  const errors = [userError, predictionsError, matchesError, groupsError].filter(Boolean);
  
  useEffect(() => {
    // Fetch data with more robust error handling
    const fetchData = async () => {
      try {
        // Fetch user data first
        if (!dataFetchStatus.profile) {
          try {
            await fetchProfile();
            setDataFetchStatus(prev => ({ ...prev, profile: true }));
          } catch (error) {
            console.error("Failed to fetch profile:", error);
          }
          
          // Wait to prevent rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Fetch groups data
        if (!dataFetchStatus.groups) {
          try {
            const groups = await fetchUserGroups();
            setDataFetchStatus(prev => ({ ...prev, groups: true }));
            
            // Set the selected group if not already set
            if (groups && groups.length > 0 && !selectedGroup) {
              setSelectedGroup(groups[0]);
            }
          } catch (error) {
            console.error("Failed to fetch groups:", error);
          }
          
          // Wait to prevent rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Fetch predictions
        if (!dataFetchStatus.predictions) {
          try {
            await fetchUserPredictions();
            setDataFetchStatus(prev => ({ ...prev, predictions: true }));
          } catch (error) {
            console.error("Failed to fetch predictions:", error);
          }
          
          // Wait to prevent rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Get live matches
        if (!dataFetchStatus.matches) {
          try {
            await refreshLiveMatches();
            setDataFetchStatus(prev => ({ ...prev, matches: true }));
          } catch (error) {
            console.error("Failed to fetch live matches:", error);
          }
          
          // Wait to prevent rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Get upcoming fixtures for next 7 days
        if (!dataFetchStatus.fixtures) {
          try {
            const today = new Date();
            const nextWeek = new Date(today);
            nextWeek.setDate(today.getDate() + 7);
            
            // Format dates as YYYY-MM-DD for backend compatibility
            const fromStr = today.toISOString().split('T')[0];
            const toStr = nextWeek.toISOString().split('T')[0];
            
            await fetchFixtures({
              from: fromStr,
              to: toStr,
              status: 'NOT_STARTED'
            });
            setDataFetchStatus(prev => ({ ...prev, fixtures: true }));
          } catch (error) {
            console.error("Failed to fetch fixtures:", error);
          }
        }
      } catch (error) {
        console.error('Error in data fetching sequence:', error);
      }
    };

    fetchData();
    
    // Set up polling for live matches every minute
    const interval = setInterval(() => {
      refreshLiveMatches();
    }, 60000);
    
    return () => clearInterval(interval);
  }, [
    fetchUserPredictions, 
    fetchUserGroups, 
    refreshLiveMatches, 
    fetchFixtures, 
    fetchProfile, 
    retryCount, 
    dataFetchStatus,
    selectedGroup,
    setSelectedGroup
  ]);

  const handleRetry = () => {
    // Reset data fetch status for failed fetches
    const newStatus = { ...dataFetchStatus };
    if (userError) newStatus.profile = false;
    if (predictionsError) newStatus.predictions = false;
    if (matchesError) newStatus.matches = false;
    if (groupsError) newStatus.groups = false;
    if (matchesError || !fixtures.length) newStatus.fixtures = false;
    
    setDataFetchStatus(newStatus);
    setRetryCount(prev => prev + 1);
  };

  if (isLoading && retryCount === 0) {
    return <LoadingSpinner />;
  }

  if (errors.length > 0) {
    return (
      <ErrorMessage 
        title="Could not load dashboard" 
        message={errors[0]}
        retry={handleRetry}
      />
    );
  }

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
      {userGroups && (userGroups.length > 0 ? (
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Your Groups</h2>
          <LeagueTable groups={userGroups} />
        </section>
      ) : (
        <section className="mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                You're not in any leagues yet
              </h3>
              <p className="text-gray-500 mb-6">
                Join a league to start making predictions and competing with friends
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link
                  to="/groups/join"
                  className="inline-flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Join League
                </Link>
                <Link
                  to="/groups/create"
                  className="inline-flex items-center px-6 py-3 border border-blue-600 rounded-md shadow-sm text-base font-medium text-blue-600 bg-white hover:bg-blue-50"
                >
                  Create League
                </Link>
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
};

export default DashboardPage;