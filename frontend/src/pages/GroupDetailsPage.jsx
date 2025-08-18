// src/pages/GroupDetailsPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { 
  useUser, 
  useGroups, 
  useNotifications,
  useLeagueContext  // <-- Use this hook instead of direct imports
} from '../contexts/AppContext';
import SeasonSelector from '../components/common/SeasonSelector';
import SeasonManager from '../utils/seasonManager';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import OnboardingGuide, { HelpTooltip } from '../components/onboarding/OnboardingGuide';

const GroupDetailsPage = () => {
  const { groupId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, fetchProfile, loading: userLoading } = useUser();
  const { 
    fetchGroupDetails, 
    fetchGroupMembers, 
    currentGroup, 
    groupMembers,
    loading: groupsLoading 
  } = useGroups();

  // Debug logging for state changes
  useEffect(() => {
    process.env.NODE_ENV === 'development' && console.log('📊 Groups Context State:', {
      currentGroup: currentGroup,
      groupMembersCount: groupMembers?.length || 0,
      groupsLoading,
      hasCurrentGroup: !!currentGroup,
      currentGroupId: currentGroup?.id,
      currentGroupLeague: currentGroup?.league
    });
  }, [currentGroup, groupMembers, groupsLoading]);

  useEffect(() => {
    process.env.NODE_ENV === 'development' && console.log('👤 User Context State:', {
      profile,
      userLoading,
      hasProfile: !!profile,
      profileId: profile?.id,
      profileUsername: profile?.username
    });
  }, [profile, userLoading]);
  const { showError, showSuccess } = useNotifications();
  
  // FIXED: Get all league functions from useLeagueContext hook
  const {
    fetchLeaderboard,
    setSelectedSeason,
    selectedSeason,
    leaderboard,
    loading: leaderboardLoading
  } = useLeagueContext();

  // Local state
  const [activeTab, setActiveTab] = useState('standings');
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState(null);
  const [seasonLoading, setSeasonLoading] = useState(false);
  
  // Guide state
  const [showGuide, setShowGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  
  // Prevent multiple fetches
  const hasFetchedRef = useRef({});
  const hasInitializedSeasonRef = useRef(false);

  // Effect: Fetch user profile
  useEffect(() => {
    process.env.NODE_ENV === 'development' && console.log('🎯 Effect: Fetch user profile triggered', { 
      hasProfile: !!profile,
      userLoading,
      profileId: profile?.id 
    });
    
    if (!profile && !userLoading) {
      process.env.NODE_ENV === 'development' && console.log('👤 Fetching user profile...');
      fetchProfile();
    }
  }, [profile, userLoading, fetchProfile]);

  // Effect: Show success message for new groups
  useEffect(() => {
    process.env.NODE_ENV === 'development' && console.log('🎯 Effect: Show success message for new groups', { 
      hasLocationState: !!location.state,
      newGroup: location.state?.newGroup,
      groupName: location.state?.groupName 
    });
    
    if (location.state?.newGroup && location.state?.groupName) {
      showSuccess(`League "${location.state.groupName}" created successfully!`);
    }
  }, [location.state, showSuccess]);

  // Effect: Load group data
  useEffect(() => {
    process.env.NODE_ENV === 'development' && console.log('🎯 Effect: Load group data triggered', { 
      groupId,
      hasCurrentGroup: !!currentGroup,
      groupsLoading,
      hasFetched: hasFetchedRef.current.groupData
    });
    
    if (groupId && !groupsLoading && !hasFetchedRef.current.groupData) {
      process.env.NODE_ENV === 'development' && console.log('📊 Loading group data...');
      hasFetchedRef.current.groupData = true;
      loadGroupData();
    }
  }, [groupId, currentGroup, groupsLoading]);

  const loadGroupData = async () => {
    try {
      process.env.NODE_ENV === 'development' && console.log('📊 Loading group details and members...');
      await Promise.all([
        fetchGroupDetails(groupId),
        fetchGroupMembers(groupId)
      ]);
    } catch (error) {
      process.env.NODE_ENV === 'development' && console.error('❌ Error loading group data:', error);
      showError('Failed to load group data');
    }
  };

  // Effect: Initialize season data
  useEffect(() => {
    process.env.NODE_ENV === 'development' && console.log('🎯 Effect: Initialize season data triggered', { 
      hasCurrentGroup: !!currentGroup,
      hasInitialized: hasInitializedSeasonRef.current,
      selectedSeason
    });
    
    if (currentGroup && !hasInitializedSeasonRef.current) {
      process.env.NODE_ENV === 'development' && console.log('📅 Initializing season data...');
      hasInitializedSeasonRef.current = true;
      initializeSeasonData();
    }
  }, [currentGroup, selectedSeason]);

  const initializeSeasonData = async () => {
    try {
      setSeasonLoading(true);
      
      // Set default season if not already set
      if (!selectedSeason && currentGroup.league) {
        const defaultSeason = SeasonManager.getCurrentSeason(currentGroup.league);
        process.env.NODE_ENV === 'development' && console.log('📅 Setting default season:', defaultSeason);
        setSelectedSeason(defaultSeason);
      }
      
      // Load leaderboard for the selected season
      if (selectedSeason) {
        await loadLeaderboard();
      }
    } catch (error) {
      process.env.NODE_ENV === 'development' && console.error('❌ Error initializing season data:', error);
      showError('Failed to initialize season data');
    } finally {
      setSeasonLoading(false);
    }
  };

  // Effect: Load leaderboard
  useEffect(() => {
    process.env.NODE_ENV === 'development' && console.log('🎯 Effect: Load leaderboard triggered', { 
      selectedSeason,
      hasCurrentGroup: !!currentGroup,
      hasInitialized: hasInitializedSeasonRef.current
    });
    
    if (selectedSeason && currentGroup && hasInitializedSeasonRef.current && !hasFetchedRef.current.leaderboard) {
      process.env.NODE_ENV === 'development' && console.log('📊 Loading leaderboard...');
      hasFetchedRef.current.leaderboard = true;
      loadLeaderboard();
    }
  }, [selectedSeason, currentGroup]);

  const loadLeaderboard = async () => {
    try {
      process.env.NODE_ENV === 'development' && console.log('📊 Loading leaderboard for season:', selectedSeason);
      await fetchLeaderboard(currentGroup.id, { season: selectedSeason });
    } catch (error) {
      process.env.NODE_ENV === 'development' && console.error('❌ Error loading leaderboard:', error);
      showError('Failed to load leaderboard');
    }
  };

  const handleSeasonChange = (newSeason) => {
    process.env.NODE_ENV === 'development' && console.log('📅 Season changed:', newSeason);
    setSelectedSeason(newSeason);
    hasFetchedRef.current.leaderboard = false;
  };

  // Loading states
  if (userLoading || groupsLoading) {
    return <LoadingSpinner />;
  }

  // Error states
  if (membersError) {
    return <ErrorMessage message={membersError} />;
  }

  if (!currentGroup) {
    return <ErrorMessage message="Group not found" />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {currentGroup.name}
            </h1>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {currentGroup.league}
              </span>
              <span>{groupMembers.length} members</span>
              {currentGroup.invite_code && (
                <HelpTooltip content="Share this invite code with friends to let them join your league">
                  <span>Code: <code className="bg-gray-100 px-2 py-1 rounded text-xs cursor-help">{currentGroup.invite_code}</code></span>
                </HelpTooltip>
              )}
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <HelpTooltip content="View all predictions made by league members">
              <button
                onClick={() => navigate(`/groups/${groupId}/predictions`)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                📊 Predictions
              </button>
            </HelpTooltip>
            <HelpTooltip content="View rivalry statistics and head-to-head matchups">
              <button
                onClick={() => navigate(`/groups/${groupId}/rivalries`)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                🥊 Rivalries
              </button>
            </HelpTooltip>
            {profile?.id === currentGroup.admin_id && (
              <HelpTooltip content="Manage league settings and members">
                <button
                  onClick={() => navigate(`/groups/${groupId}/manage`)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  ⚙️ Manage
                </button>
              </HelpTooltip>
            )}
            <HelpTooltip content="Start the guided tour to learn about league features">
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
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="sm:flex sm:space-x-8">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('standings')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'standings'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Standings
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'members'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Members ({groupMembers.length})
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow">
        {activeTab === 'standings' && (
          <div className="p-6">
            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-6">
              <SeasonSelector
                league={currentGroup.league}
                selectedSeason={selectedSeason}
                onSeasonChange={handleSeasonChange}
                disabled={seasonLoading}
                className="w-full sm:w-auto"
              />
            </div>

            {/* Season Display Info */}
            {selectedSeason && currentGroup.league && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  Showing {currentGroup.league} season: <strong>{SeasonManager.getSeasonForDisplay(currentGroup.league, selectedSeason)}</strong>
                </p>
              </div>
            )}

            {/* Leaderboard Table */}
            {leaderboardLoading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rank
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Player
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Points
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Predictions
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Perfect
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Accuracy
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Avg Points
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {leaderboard && leaderboard.length > 0 ? (
                      leaderboard.map((entry, index) => (
                        <tr 
                          key={entry.user_id} 
                          className={`${
                            entry.username === profile?.username ? 'bg-blue-50' : ''
                          } ${index === 0 ? 'bg-yellow-50' : ''} hover:bg-gray-50`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {entry.rank === 1 && '🏆'} {entry.rank}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {entry.username}
                              {entry.username === profile?.username && (
                                <span className="ml-2 text-xs text-blue-600">(You)</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 font-semibold">
                            {entry.total_points}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                            {entry.total_predictions}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-green-600 font-medium">
                            {entry.perfect_scores}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                            {entry.accuracy_percentage}%
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-purple-600">
                            {entry.average_points}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                          {selectedSeason ? (
                            <>
                              No predictions found for {SeasonManager.getSeasonForDisplay(currentGroup.league, selectedSeason)}.
                              <br />
                              <span className="text-sm">Members will appear here once they make predictions.</span>
                            </>
                          ) : (
                            'Loading season data...'
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'members' && (
          <div className="p-6">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Group Members ({groupMembers.length})
              </h3>
              <p className="text-sm text-gray-600">
                Manage your league members and their permissions.
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Member
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {groupMembers.map((member) => (
                    <tr key={member.user_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {member.username}
                          {member.username === profile?.username && (
                            <span className="ml-2 text-xs text-blue-600">(You)</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          member.role === 'ADMIN' 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {member.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(member.joined_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          member.status === 'APPROVED' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {member.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      
      {/* Guide/Help System */}
      <OnboardingGuide
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
        onComplete={() => setShowGuide(false)}
        step={guideStep}
        totalSteps={5}
        steps={[
          {
            title: "League Overview",
            content: "This is your league's main page. Here you can view standings, manage members, and access league features.",
            action: "Next",
            highlight: null
          },
          {
            title: "Standings Tab",
            content: "View the current leaderboard and see how all members are performing. Use filters to view specific seasons and weeks.",
            action: "Next",
            highlight: null
          },
          {
            title: "Members Tab",
            content: "See all league members, their roles, and when they joined. Admins can manage member permissions here.",
            action: "Next",
            highlight: null
          },
          {
            title: "League Features",
            content: "Access predictions page to see all member predictions, rivalry statistics, and league management tools.",
            action: "Next",
            highlight: null
          },
          {
                    title: "Season Filter",
        content: "Use the season selector to view standings for specific time periods. Different leagues have different season formats.",
            action: "Got it!",
            highlight: null
          }
        ]}
      />
    </div>
  );
};

export default GroupDetailsPage;