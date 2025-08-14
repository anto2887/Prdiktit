// src/pages/DashboardPage.jsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
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
import OnboardingGuide, { HelpTooltip } from '../components/onboarding/OnboardingGuide';

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
  
  // FIXED: Use ref to prevent circular dependency in useCallback
  const dataFetchStatusRef = useRef({
    profile: false,
    predictions: false,
    groups: false,
    matches: false,
    fixtures: false
  });
  
  // Guide state
  const [showGuide, setShowGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);

  // Combined loading and error states
  const isLoading = userLoading || predictionsLoading || matchesLoading || groupsLoading;
  const errors = [userError, predictionsError, matchesError, groupsError].filter(Boolean);
  
  // FIXED: Wrap fetchData in useCallback to prevent infinite loops and ensure proper execution
  const fetchData = useCallback(async () => {
    try {
      process.env.NODE_ENV === 'development' && console.log('DashboardPage: Starting data fetch sequence');
      
      // STEP 1: Fetch user profile FIRST (this is critical for admin checks)
      if (!dataFetchStatusRef.current.profile) {
        try {
          process.env.NODE_ENV === 'development' && console.log('DashboardPage: Fetching user profile...');
          await fetchProfile();
          setDataFetchStatus(prev => ({ ...prev, profile: true }));
          dataFetchStatusRef.current.profile = true;
          process.env.NODE_ENV === 'development' && console.log('DashboardPage: User profile fetched successfully');
        } catch (error) {
          process.env.NODE_ENV === 'development' && console.error("DashboardPage: Failed to fetch profile:", error);
          // Don't continue if profile fetch fails - this is critical
          return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // STEP 2: Fetch groups data (needed for admin checks)
      if (!dataFetchStatusRef.current.groups) {
        try {
          process.env.NODE_ENV === 'development' && console.log('DashboardPage: Fetching user groups...');
          const groups = await fetchUserGroups();
          setDataFetchStatus(prev => ({ ...prev, groups: true }));
          dataFetchStatusRef.current.groups = true;
          process.env.NODE_ENV === 'development' && console.log('DashboardPage: User groups fetched:', groups);
          
          if (groups && groups.length > 0 && !selectedGroup) {
            process.env.NODE_ENV === 'development' && console.log('DashboardPage: Setting default selected group to:', groups[0]);
            setSelectedGroup(groups[0]);
          }
        } catch (error) {
          process.env.NODE_ENV === 'development' && console.error("DashboardPage: Failed to fetch groups:", error);
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // STEP 3: Fetch predictions
      if (!dataFetchStatusRef.current.predictions) {
        try {
          process.env.NODE_ENV === 'development' && console.log('DashboardPage: Fetching user predictions...');
          const predictionsResult = await fetchUserPredictions();
          process.env.NODE_ENV === 'development' && console.log('DashboardPage: fetchUserPredictions returned:', predictionsResult);
          setDataFetchStatus(prev => ({ ...prev, predictions: true }));
          dataFetchStatusRef.current.predictions = true;
          process.env.NODE_ENV === 'development' && console.log('DashboardPage: User predictions fetched successfully');
        } catch (error) {
          process.env.NODE_ENV === 'development' && console.error("DashboardPage: Failed to fetch predictions:", error);
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // STEP 4: Get live matches
      if (!dataFetchStatusRef.current.matches) {
        try {
          process.env.NODE_ENV === 'development' && console.log('DashboardPage: Fetching live matches...');
          await refreshLiveMatches();
          setDataFetchStatus(prev => ({ ...prev, matches: true }));
          dataFetchStatusRef.current.matches = true;
          process.env.NODE_ENV === 'development' && console.log('DashboardPage: Live matches fetched successfully');
        } catch (error) {
          process.env.NODE_ENV === 'development' && console.error("DashboardPage: Failed to fetch live matches:", error);
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // STEP 5: Get upcoming fixtures
      if (!dataFetchStatusRef.current.fixtures) {
        try {
          process.env.NODE_ENV === 'development' && console.log('DashboardPage: Fetching upcoming fixtures...');
          const now = new Date();
          const nextWeek = new Date(now);
          nextWeek.setDate(now.getDate() + 7);
          
          const fromStr = now.toISOString();
          const toStr = nextWeek.toISOString();
          
          await fetchFixtures({
            from: fromStr,
            to: toStr,
            status: 'NOT_STARTED'
          });
          setDataFetchStatus(prev => ({ ...prev, fixtures: true }));
          dataFetchStatusRef.current.fixtures = true;
          process.env.NODE_ENV === 'development' && console.log('DashboardPage: Data fetch sequence completed');
        } catch (error) {
          process.env.NODE_ENV === 'development' && console.error("DashboardPage: Failed to fetch fixtures:", error);
        }
      }
      
      process.env.NODE_ENV === 'development' && console.log('DashboardPage: Data fetch sequence completed');
    } catch (error) {
      process.env.NODE_ENV === 'development' && console.error('DashboardPage: Error in data fetching sequence:', error);
    }
  }, [
    fetchProfile,
    fetchUserGroups,
    fetchUserPredictions,
    refreshLiveMatches,
    fetchFixtures,
    selectedGroup,
    setSelectedGroup,
    setDataFetchStatus
  ]);

  useEffect(() => {
    fetchData();
    
    // Set up polling for live matches every 2 minutes
    const interval = setInterval(() => {
      if (!matchesLoading) {
        refreshLiveMatches();
      }
    }, 120000);
    
    return () => clearInterval(interval);
  }, [
    fetchData,
    retryCount, 
    selectedGroup,
    matchesLoading
  ]);

  // FIXED: Add debug logging for profile state
  useEffect(() => {
    process.env.NODE_ENV === 'development' && console.log('DashboardPage: Profile state changed:', {
      profile,
      hasProfile: !!profile,
      profileId: profile?.id,
      username: profile?.username
    });
  }, [profile]);

  // FIXED: Add debug logging for predictions state
  useEffect(() => {
    process.env.NODE_ENV === 'development' && console.log('DashboardPage: Predictions state changed:', {
      userPredictions,
      predictionsLength: userPredictions?.length || 0,
      predictionsLoading: predictionsLoading,
      predictionsError: predictionsError
    });
  }, [userPredictions, predictionsLoading, predictionsError]);

  // FIXED: Add debug logging for groups state
  useEffect(() => {
    process.env.NODE_ENV === 'development' && console.log('DashboardPage: Groups state changed:', {
      userGroups,
      groupCount: userGroups?.length || 0,
      selectedGroup
    });
  }, [userGroups, selectedGroup]);

  const handleRetry = () => {
    process.env.NODE_ENV === 'development' && console.log('DashboardPage: Retrying failed data fetches...');
    const newStatus = { ...dataFetchStatus };
    if (userError) {
      newStatus.profile = false;
      dataFetchStatusRef.current.profile = false;
    }
    if (predictionsError) {
      newStatus.predictions = false;
      dataFetchStatusRef.current.predictions = false;
    }
    if (matchesError) {
      newStatus.matches = false;
      dataFetchStatusRef.current.matches = false;
    }
    if (groupsError) {
      newStatus.groups = false;
      dataFetchStatusRef.current.groups = false;
    }
    if (matchesError || !fixtures.length) {
      newStatus.fixtures = false;
      dataFetchStatusRef.current.fixtures = false;
    }
    
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
        onRetry={handleRetry}
      />
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <HelpTooltip content="Start the guided tour to learn about your dashboard">
          <button
            onClick={() => setShowGuide(true)}
            className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </HelpTooltip>
      </div>
      
      {/* Stats section */}
      <section className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Your Stats</h2>
          <HelpTooltip content="View your overall prediction performance and statistics">
            <span className="text-gray-400">ℹ️</span>
          </HelpTooltip>
        </div>
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
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Your Recent Predictions</h2>
          <HelpTooltip content="Your latest predictions and their results">
            <span className="text-gray-400">ℹ️</span>
          </HelpTooltip>
        </div>
        <RecentPredictions predictions={userPredictions} />
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-2 text-xs text-gray-500 bg-gray-100 p-2 rounded">
            Debug: userPredictions passed to RecentPredictions: {userPredictions?.length || 0} items
          </div>
        )}
      </section>
      
      {/* League table section */}
      {userGroups && (userGroups.length > 0 ? (
        <section className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Your Groups</h2>
            <div className="flex gap-2">
              <HelpTooltip content="Join an existing league using an invite code">
                <Link
                  to="/groups/join"
                  className="px-4 py-2 border border-blue-600 rounded-md text-sm font-medium text-blue-600 bg-white hover:bg-blue-50"
                >
                  Join League
                </Link>
              </HelpTooltip>
              <HelpTooltip content="Create a new league and invite friends to compete">
                <Link
                  to="/groups/create"
                  className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Create League
                </Link>
              </HelpTooltip>
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
      
      {/* Guide/Help System */}
      <OnboardingGuide
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
        onComplete={() => setShowGuide(false)}
        step={guideStep}
        totalSteps={5}
        steps={[
          {
            title: "Welcome to Your Dashboard!",
            content: "This is your central hub for all football prediction activities. Let's explore what you can do here.",
            action: "Next",
            highlight: null
          },
          {
            title: "Your Stats",
            content: "View your overall performance including total points, prediction accuracy, and ranking across all your leagues.",
            action: "Next",
            highlight: null
          },
          {
            title: "Recent Predictions",
            content: "See your latest predictions and their results. Track how well you're performing in recent matches.",
            action: "Next",
            highlight: null
          },
          {
            title: "Your Groups",
            content: "Manage your leagues here. Join existing leagues or create new ones to compete with friends.",
            action: "Next",
            highlight: null
          },
          {
            title: "Navigation",
            content: "Use the navigation menu to access predictions, analytics, and other features. Everything is just a click away!",
            action: "Got it!",
            highlight: null
          }
        ]}
      />
    </div>
  );
};

export default DashboardPage;