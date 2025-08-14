// src/components/dashboard/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  useUser, 
  usePredictions, 
  useGroups, 
  useLeagueContext 
} from '../../contexts/AppContext';
import DashboardStats from './DashboardStats';
import RecentPredictions from './RecentPredictions';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import OnboardingGuide, { HelpTooltip } from '../onboarding/OnboardingGuide';

const Dashboard = () => {
  const { profile, stats, loading: userLoading, error: userError } = useUser();
  const { loading: predictionsLoading, error: predictionsError } = usePredictions();
  const { userGroups, fetchUserGroups, loading: groupsLoading, error: groupsError } = useGroups();
  const { fetchLeaderboard } = useLeagueContext();
  
  // State to store group leaderboards
  const [groupLeaderboards, setGroupLeaderboards] = useState({});
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  
  // Guide state
  const [showGuide, setShowGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);

  // Only show loading spinner for critical user data, not predictions
  const isLoading = userLoading;
  const error = userError;
  
  // Debug logging for loading states
  if (process.env.NODE_ENV === 'development') {
    console.log('Dashboard: Loading states:', { userLoading, predictionsLoading, isLoading });
    console.log('Dashboard: Errors:', { userError, predictionsError, error });
  }

  // FIXED: Ensure groups are fetched when component mounts (only once)
  useEffect(() => {
    if (!userGroups || userGroups.length === 0) {
      process.env.NODE_ENV === 'development' && console.log('Dashboard: Fetching user groups...');
      fetchUserGroups();
    }
  }, [fetchUserGroups]); // Removed userGroups dependency to prevent infinite loop



  // Fetch leaderboards for all user groups
  useEffect(() => {
    const fetchAllLeaderboards = async () => {
      if (!userGroups || userGroups.length === 0) return;
      
      setLeaderboardLoading(true);
      const leaderboards = {};
      
      try {
        await Promise.all(
          userGroups.map(async (group) => {
            try {
              process.env.NODE_ENV === 'development' && console.log(`Fetching leaderboard for group ${group.id}`);
              const leaderboard = await fetchLeaderboard(group.id);
              leaderboards[group.id] = leaderboard || [];
            } catch (err) {
              process.env.NODE_ENV === 'development' && console.error(`Error fetching leaderboard for group ${group.id}:`, err);
              leaderboards[group.id] = [];
            }
          })
        );
        
        setGroupLeaderboards(leaderboards);
        process.env.NODE_ENV === 'development' && console.log('All leaderboards fetched:', leaderboards);
      } catch (err) {
        process.env.NODE_ENV === 'development' && console.error('Error fetching group leaderboards:', err);
      } finally {
        setLeaderboardLoading(false);
      }
    };

    fetchAllLeaderboards();
  }, [userGroups, fetchLeaderboard]);

  // Add this after the existing useEffect hooks
  useEffect(() => {
    process.env.NODE_ENV === 'development' && console.log('=== DASHBOARD DEBUG ===');
    process.env.NODE_ENV === 'development' && console.log('Profile:', profile);
    process.env.NODE_ENV === 'development' && console.log('Groups:', userGroups);
    process.env.NODE_ENV === 'development' && console.log('Predictions Loading:', predictionsLoading);
    process.env.NODE_ENV === 'development' && console.log('Group leaderboards:', groupLeaderboards);
    process.env.NODE_ENV === 'development' && console.log('Leaderboard loading:', leaderboardLoading);
  }, [profile, userGroups, predictionsLoading, groupLeaderboards, leaderboardLoading]);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  // Helper function to get user's position and points in a group
  const getUserStatsInGroup = (groupId) => {
    const leaderboard = groupLeaderboards[groupId] || [];
    const userEntry = leaderboard.find(entry => entry.username === profile?.username);
    
    if (!userEntry) {
      return { rank: '-', points: 0, total_predictions: 0 };
    }
    
    return {
      rank: userEntry.rank,
      points: userEntry.total_points || 0,
      total_predictions: userEntry.total_predictions || 0
    };
  };

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {profile?.username}!
          </h1>
          <div className="flex items-center space-x-3">
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
            <Link
              to="/predictions/new"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Post Your Prediction →
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stats Section */}
        <section id="stats-section" className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Your Stats</h2>
              <HelpTooltip content="View your overall prediction performance and statistics">
                <svg className="w-4 h-4 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </HelpTooltip>
            </div>
          </div>
          <div className="p-6">
            <DashboardStats stats={stats} />
          </div>
        </section>

        {/* Recent Predictions Section */}
        <section id="recent-predictions" className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Recent Predictions</h2>
              <HelpTooltip content="Your latest predictions and their results">
                <svg className="w-4 h-4 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </HelpTooltip>
            </div>
          </div>
          <div className="p-6">
            <RecentPredictions />
          </div>
        </section>
      </div>

      {/* League Table Section - Full Width */}
      <section id="leagues-section" className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">My Leagues</h2>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
              <HelpTooltip content="Join an existing league using an invite code">
                <Link
                  to="/groups/join"
                  className="inline-flex items-center justify-center px-4 py-2 border border-blue-600 rounded-md shadow-sm text-sm font-medium text-blue-600 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Join League
                </Link>
              </HelpTooltip>
              <HelpTooltip content="Create a new league and invite friends to compete">
                <Link
                  to="/groups/create"
                  className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Create League
                </Link>
              </HelpTooltip>
            </div>
          </div>

          {/* Enhanced group display with points */}
          {!userGroups || userGroups.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
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
                  Enter League Code →
                </Link>
                <Link
                  to="/groups/create"
                  className="inline-flex items-center px-6 py-3 border border-blue-600 rounded-md shadow-sm text-base font-medium text-blue-600 bg-white hover:bg-blue-50"
                >
                  Create Your Own League
                </Link>
              </div>
            </div>
          ) : (
            <div>
              {/* Display groups as enhanced cards with points */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {userGroups.map(group => {
                  const userStats = getUserStatsInGroup(group.id);
                  const isLoading = leaderboardLoading;
                  
                  return (
                    <div key={group.id} className="bg-white border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="text-lg font-medium text-gray-900">{group.name}</h4>
                          {group.role === 'ADMIN' && (
                            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                              Admin
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{group.league}</p>
                        
                        {/* Points and ranking section */}
                        <div className="bg-gray-50 rounded-lg p-3 mb-3">
                          {isLoading ? (
                            <div className="flex justify-center">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div>
                                <div className="text-lg font-bold text-blue-600">{userStats.points}</div>
                                <div className="text-xs text-gray-500">Points</div>
                              </div>
                              <div>
                                <div className="text-lg font-bold text-green-600">#{userStats.rank}</div>
                                <div className="text-xs text-gray-500">Rank</div>
                              </div>
                              <div>
                                <div className="text-lg font-bold text-purple-600">{userStats.total_predictions}</div>
                                <div className="text-xs text-gray-500">Predictions</div>
                              </div>
                            </div>
                          )}
                        </div>
                        
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
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>
      
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
            content: "This is your central hub for managing predictions, tracking performance, and competing in leagues. Let's explore the key features.",
            action: "Next",
            highlight: null
          },
          {
            title: "Your Statistics",
            content: "View your overall prediction performance including total points, accuracy, and ranking across all your leagues.",
            action: "Next",
            highlight: "stats-section"
          },
          {
            title: "Recent Predictions",
            content: "See your latest predictions and their results. Perfect predictions earn 3 points, correct results earn 1 point.",
            action: "Next",
            highlight: "recent-predictions"
          },
          {
            title: "My Leagues",
            content: "Manage your leagues here. Join existing leagues with invite codes or create new ones to compete with friends.",
            action: "Next",
            highlight: "leagues-section"
          },
          {
            title: "Getting Started",
            content: "Click 'Post Your Prediction' to make new predictions, or visit your leagues to see how you rank against friends!",
            action: "Got it!",
            highlight: null
          }
        ]}
      />
    </div>
  );
};

export default Dashboard;