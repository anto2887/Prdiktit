// src/pages/GroupDetailsPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { useGroups, useUser, useLeagueContext } from '../contexts/AppContext';

// Components
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';

const GroupDetailsPage = () => {
  const { groupId } = useParams();
  const location = useLocation();
  const { 
    currentGroup, 
    fetchGroupDetails, 
    fetchGroupMembers, 
    isAdmin, 
    loading, 
    error,
    clearGroupData,
    setCurrentGroup
  } = useGroups();
  const { profile } = useUser();
  const { selectedSeason, selectedWeek, setSelectedSeason, setSelectedWeek, fetchLeaderboard } = useLeagueContext();
  
  const [groupMembers, setGroupMembers] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [membersError, setMembersError] = useState(null);
  const [activeTab, setActiveTab] = useState('standings');
  
  const currentGroupIdRef = useRef(null);
  const hasFetchedRef = useRef({});

  const isNewGroup = location.state?.newGroup || false;
  const inviteCode = location.state?.inviteCode || '';
  const groupName = location.state?.groupName || '';

  // Clear data when group changes
  useEffect(() => {
    const numericGroupId = parseInt(groupId);
    
    if (currentGroupIdRef.current !== null && currentGroupIdRef.current !== numericGroupId) {
      setCurrentGroup(null);
      setGroupMembers([]);
      setLeaderboard([]);
      setMembersError(null);
      hasFetchedRef.current = {};
    }
    
    currentGroupIdRef.current = numericGroupId;
  }, [groupId, setCurrentGroup]);

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
          setGroupMembers(members);
        } else {
          setGroupMembers([]);
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

  // Load leaderboard data
  useEffect(() => {
    const loadLeaderboard = async () => {
      const numericGroupId = parseInt(groupId);
      if (!numericGroupId) return;

      setLeaderboardLoading(true);
      try {
        console.log('Fetching leaderboard for group:', numericGroupId);
        const leaderboardData = await fetchLeaderboard(numericGroupId, {
          season: selectedSeason,
          week: selectedWeek
        });
        
        console.log('Leaderboard data received:', leaderboardData);
        setLeaderboard(leaderboardData || []);
      } catch (err) {
        console.error('Error loading leaderboard:', err);
        setLeaderboard([]);
      } finally {
        setLeaderboardLoading(false);
      }
    };

    if (currentGroup) {
      loadLeaderboard();
    }
  }, [groupId, currentGroup, selectedSeason, selectedWeek, fetchLeaderboard]);

  if (loading || !currentGroup) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{currentGroup.name}</h1>
              <p className="text-gray-600">{currentGroup.league}</p>
            </div>
            <div className="flex gap-3">
              {isAdmin(currentGroup.id) && (
                <Link
                  to={`/groups/${currentGroup.id}/manage`}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Manage League
                </Link>
              )}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(currentGroup.invite_code);
                  // Add toast notification here
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Share Code: {currentGroup.invite_code}
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6">
          <nav className="flex space-x-8">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Season</label>
                <select
                  value={selectedSeason || '2024-2025'}
                  onChange={(e) => setSelectedSeason(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="2024-2025">2024-2025</option>
                  <option value="2023-2024">2023-2024</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Week</label>
                <select
                  value={selectedWeek || ''}
                  onChange={(e) => setSelectedWeek(e.target.value ? parseInt(e.target.value) : null)}
                  className="border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">All Weeks</option>
                  {Array.from({ length: 38 }, (_, i) => i + 1).map(week => (
                    <option key={week} value={week}>Week {week}</option>
                  ))}
                </select>
              </div>
            </div>

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
                    {leaderboard.length > 0 ? (
                      leaderboard.map((entry, index) => (
                        <tr 
                          key={entry.user_id} 
                          className={`${
                            entry.username === profile?.username ? 'bg-blue-50' : ''
                          } ${index === 0 ? 'bg-yellow-50' : ''}`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {entry.rank}
                            {index === 0 && <span className="ml-2">👑</span>}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="text-sm font-medium text-gray-900">
                                {entry.username}
                                {entry.username === profile?.username && (
                                  <span className="ml-2 text-xs text-blue-600">(You)</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-blue-600">
                            {entry.total_points}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                            {entry.total_predictions}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-green-600">
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
                          No leaderboard data available yet. Start making predictions!
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
            {membersLoading ? (
              <LoadingSpinner />
            ) : membersError ? (
              <ErrorMessage message={membersError} />
            ) : (
              <div className="grid gap-4">
                {groupMembers.map((member) => (
                  <div key={member.user_id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium">{member.username}</h3>
                      <p className="text-sm text-gray-500">
                        {member.role === 'ADMIN' ? 'Administrator' : 'Member'}
                        {member.joined_at && ` • Joined ${new Date(member.joined_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="text-right">
                      {member.role === 'ADMIN' && (
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                          Admin
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupDetailsPage;