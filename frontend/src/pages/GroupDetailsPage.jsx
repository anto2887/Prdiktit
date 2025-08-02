// src/pages/GroupDetailsPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { 
  useAuth, 
  useGroups, 
  useNotifications,
  fetchLeaderboard,
  fetchGroupSeasons,
  setSelectedSeason,
  setSelectedWeek,
  selectedSeason,
  selectedWeek,
  leaderboard,
  availableSeasons,
  getCurrentSeason,
  getSeasonForDisplay
} from '../contexts/AppContext';
import SeasonSelector from '../components/common/SeasonSelector';
import SeasonManager from '../utils/seasonManager';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';

const GroupDetailsPage = () => {
  const { groupId } = useParams();
  const location = useLocation();
  const { profile } = useAuth();
  const { 
    fetchGroupDetails, 
    fetchGroupMembers, 
    currentGroup, 
    groupMembers,
    loading: groupsLoading 
  } = useGroups();
  const { showError, showSuccess } = useNotifications();

  // Local state
  const [activeTab, setActiveTab] = useState('standings');
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [seasonLoading, setSeasonLoading] = useState(false);
  
  // Prevent multiple fetches
  const hasFetchedRef = useRef({});
  const hasInitializedSeasonRef = useRef(false);

  // Show success message for new groups
  useEffect(() => {
    if (location.state?.newGroup && location.state?.groupName) {
      showSuccess(`League "${location.state.groupName}" created successfully!`);
    }
  }, [location.state, showSuccess]);

  // Load group data
  useEffect(() => {
    const loadGroupData = async () => {
      const numericGroupId = parseInt(groupId);
      
      if (!profile || !numericGroupId) return;

      const fetchKey = `${numericGroupId}_${profile.id}`;
      if (hasFetchedRef.current[fetchKey]) return;

      try {
        // Load group details
        const groupDetails = await fetchGroupDetails(numericGroupId);
        if (!groupDetails) {
          setMembersError('Failed to load group details');
          return;
        }
        
        // Load group members
        setMembersLoading(true);
        setMembersError(null);
        
        const members = await fetchGroupMembers(numericGroupId);
        
        if (Array.isArray(members)) {
          console.log(`Loaded ${members.length} members for group ${numericGroupId}`);
        } else {
          console.warn('Members data is not an array:', members);
        }
        
        hasFetchedRef.current[fetchKey] = true;
        
      } catch (err) {
        console.error('Error loading group data:', err);
        setMembersError('Failed to load group data');
      } finally {
        setMembersLoading(false);
      }
    };

    loadGroupData();
  }, [groupId, profile?.id, fetchGroupDetails, fetchGroupMembers]);

  // Initialize season data when group is loaded
  useEffect(() => {
    const initializeSeasonData = async () => {
      const numericGroupId = parseInt(groupId);
      
      if (!currentGroup || !currentGroup.league || hasInitializedSeasonRef.current) {
        return;
      }

      try {
        setSeasonLoading(true);
        
        // Fetch available seasons for this group
        const seasons = await fetchGroupSeasons(numericGroupId);
        console.log('Available seasons for group:', seasons);
        
        // Set default season if none selected
        if (!selectedSeason && currentGroup.league) {
          const defaultSeason = getCurrentSeason(currentGroup.league);
          console.log(`Setting default season for ${currentGroup.league}:`, defaultSeason);
          setSelectedSeason(defaultSeason, numericGroupId);
        }
        
        hasInitializedSeasonRef.current = true;
        
      } catch (error) {
        console.error('Error initializing season data:', error);
      } finally {
        setSeasonLoading(false);
      }
    };

    initializeSeasonData();
  }, [currentGroup, groupId, selectedSeason, fetchGroupSeasons, getCurrentSeason, setSelectedSeason]);

  // Load leaderboard data when season/week changes
  useEffect(() => {
    const loadLeaderboard = async () => {
      const numericGroupId = parseInt(groupId);
      
      if (!numericGroupId || !currentGroup || !selectedSeason) {
        return;
      }

      setLeaderboardLoading(true);
      try {
        console.log(`Fetching leaderboard for group ${numericGroupId}, league: ${currentGroup.league}, season: ${selectedSeason}, week: ${selectedWeek}`);
        
        const leaderboardData = await fetchLeaderboard(numericGroupId, {
          season: selectedSeason,
          week: selectedWeek,
          league: currentGroup.league
        });
        
        console.log('Leaderboard data received:', leaderboardData);
        
      } catch (err) {
        console.error('Error loading leaderboard:', err);
        showError('Failed to load leaderboard data');
      } finally {
        setLeaderboardLoading(false);
      }
    };

    loadLeaderboard();
  }, [groupId, currentGroup, selectedSeason, selectedWeek, fetchLeaderboard, showError]);

  // Reset season initialization when group changes
  useEffect(() => {
    hasInitializedSeasonRef.current = false;
  }, [groupId]);

  // Loading state
  if (groupsLoading || membersLoading || !currentGroup) {
    return <LoadingSpinner />;
  }

  // Error state
  if (membersError) {
    return <ErrorMessage message={membersError} />;
  }

  const handleSeasonChange = (newSeason) => {
    console.log('Season changed to:', newSeason);
    setSelectedSeason(newSeason, parseInt(groupId));
  };

  const handleWeekChange = (newWeek) => {
    console.log('Week changed to:', newWeek);
    setSelectedWeek(newWeek);
  };

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
                <span>Code: <code className="bg-gray-100 px-2 py-1 rounded text-xs">{currentGroup.invite_code}</code></span>
              )}
            </div>
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
              
              <div className="w-full sm:w-auto">
                <label className="block text-sm font-medium text-gray-700 mb-1">Week</label>
                <select
                  value={selectedWeek || ''}
                  onChange={(e) => handleWeekChange(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Weeks</option>
                  {Array.from({ length: 38 }, (_, i) => i + 1).map(week => (
                    <option key={week} value={week}>Week {week}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Season Display Info */}
            {selectedSeason && currentGroup.league && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  Showing {currentGroup.league} season: <strong>{getSeasonForDisplay(currentGroup.league, selectedSeason)}</strong>
                  {selectedWeek && ` • Week ${selectedWeek}`}
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
                              No predictions found for {getSeasonForDisplay(currentGroup.league, selectedSeason)}
                              {selectedWeek && ` week ${selectedWeek}`}.
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
    </div>
  );
};

export default GroupDetailsPage;