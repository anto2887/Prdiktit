// src/pages/DashboardPage.jsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  useUser, 
  usePredictions, 
  useGroups, 
  useMatches, 
  useLeagueContext 
} from '../contexts/AppContext';

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
    // FIXED: Fetch data with better error handling and proper sequencing
    const fetchData = async () => {
      try {
        console.log('DashboardPage: Starting data fetch sequence');
        
        // STEP 1: Fetch user profile FIRST (this is critical for admin checks)
        if (!dataFetchStatus.profile) {
          try {
            console.log('DashboardPage: Fetching user profile...');
            await fetchProfile();
            setDataFetchStatus(prev => ({ ...prev, profile: true }));
            console.log('DashboardPage: User profile fetched successfully');
          } catch (error) {
            console.error("DashboardPage: Failed to fetch profile:", error);
            // Don't continue if profile fetch fails - this is critical
            return;
          }
          
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        // STEP 2: Fetch groups data (needed for admin checks)
        if (!dataFetchStatus.groups) {
          try {
            console.log('DashboardPage: Fetching user groups...');
            const groups = await fetchUserGroups();
            setDataFetchStatus(prev => ({ ...prev, groups: true }));
            console.log('DashboardPage: User groups fetched:', groups);
            
            if (groups && groups.length > 0 && !selectedGroup) {
              console.log('DashboardPage: Setting default selected group to:', groups[0]);
              setSelectedGroup(groups[0]);
            }
          } catch (error) {
            console.error("DashboardPage: Failed to fetch groups:", error);
          }
          
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // STEP 3: Fetch predictions
        if (!dataFetchStatus.predictions) {
          try {
            console.log('DashboardPage: Fetching user predictions...');
            await fetchUserPredictions();
            setDataFetchStatus(prev => ({ ...prev, predictions: true }));
            console.log('DashboardPage: User predictions fetched successfully');
          } catch (error) {
            console.error("DashboardPage: Failed to fetch predictions:", error);
          }
          
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // STEP 4: Get live matches
        if (!dataFetchStatus.matches) {
          try {
            console.log('DashboardPage: Fetching live matches...');
            await refreshLiveMatches();
            setDataFetchStatus(prev => ({ ...prev, matches: true }));
            console.log('DashboardPage: Live matches fetched successfully');
          } catch (error) {
            console.error("DashboardPage: Failed to fetch live matches:", error);
          }
          
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // STEP 5: Get upcoming fixtures
        if (!dataFetchStatus.fixtures) {
          try {
            console.log('DashboardPage: Fetching upcoming fixtures...');
            const today = new Date();
            const nextWeek = new Date(today);
            nextWeek.setDate(today.getDate() + 7);
            
            const fromStr = today.toISOString().split('T')[0];
            const toStr = nextWeek.toISOString().split('T')[0];
            
            await fetchFixtures({
              from: fromStr,
              to: toStr,
              status: 'NOT_STARTED'
            });
            setDataFetchStatus(prev => ({ ...prev, fixtures: true }));
            console.log('DashboardPage: Upcoming fixtures fetched successfully');
          } catch (error) {
            console.error("DashboardPage: Failed to fetch fixtures:", error);
          }
        }
        
        console.log('DashboardPage: Data fetch sequence completed');
      } catch (error) {
        console.error('DashboardPage: Error in data fetching sequence:', error);
      }
    };

    fetchData();
    
    // Set up polling for live matches every 2 minutes
    const interval = setInterval(() => {
      if (!matchesLoading) {
        refreshLiveMatches();
      }
    }, 120000);
    
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
    setSelectedGroup,
    matchesLoading
  ]);

  // FIXED: Add debug logging for profile state
  useEffect(() => {
    console.log('DashboardPage: Profile state changed:', {
      profile,
      hasProfile: !!profile,
      profileId: profile?.id,
      username: profile?.username
    });
  }, [profile]);

  // FIXED: Add debug logging for groups state
  useEffect(() => {
    console.log('DashboardPage: Groups state changed:', {
      userGroups,
      groupCount: userGroups?.length || 0,
      selectedGroup
    });
  }, [userGroups, selectedGroup]);

  const handleRetry = () => {
    console.log('DashboardPage: Retrying failed data fetches...');
    const newStatus = { ...dataFetchStatus };
    if (userError) newStatus.profile = false;
    if (predictionsError) newStatus.predictions = false;
    if (matchesError) newStatus.matches = false;
    if (groupsError) newStatus.groups = false;
    if (matchesError || !fixtures.length) newStatus.fixtures = false;
    
    setDataFetchStatus(newStatus);
    setRetryCount(prev => prev + 1);
  };

  if (isLoading && retryCount === 0 && !profile) {
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
      
      {/* FIXED: Add debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mb-4 p-4 bg-gray-100 rounded text-sm">
          <div><strong>Debug Info:</strong></div>
          <div>Profile loaded: {!!profile ? 'YES' : 'NO'}</div>
          <div>Profile ID: {profile?.id || 'N/A'}</div>
          <div>Username: {profile?.username || 'N/A'}</div>
          <div>Groups loaded: {userGroups?.length || 0}</div>
          <div>Selected group: {selectedGroup?.name || 'None'}</div>
          <div>Data fetch status: {JSON.stringify(dataFetchStatus)}</div>
        </div>
      )}
      
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
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Your Groups</h2>
            <div className="flex gap-2">
              <Link
                to="/groups/join"
                className="px-4 py-2 border border-blue-600 rounded-md text-sm font-medium text-blue-600 bg-white hover:bg-blue-50"
              >
                Join League
              </Link>
              <Link
                to="/groups/create"
                className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Create League
              </Link>
            </div>
          </div>
          
          {/* FIXED: Show list of groups with links */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {userGroups.map(group => (
              <div key={group.id} className="bg-white rounded-lg shadow-md overflow-hidden border-l-4 border-blue-500">
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-medium text-gray-900">{group.name}</h3>
                    {group.role === 'ADMIN' && (
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                        Admin
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{group.league}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">
                      {group.member_count || 1} members
                    </span>
                    <Link
                      to={`/groups/${group.id}`}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      View League →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
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