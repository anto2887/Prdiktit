// src/pages/GroupDetailsPage.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { useGroups } from '../contexts/GroupContext';
import { useUser } from '../contexts/UserContext';

// Components
import LeagueTable from '../components/dashboard/LeagueTable';
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
    userGroups
  } = useGroups();
  const { profile } = useUser();
  const [groupMembers, setGroupMembers] = useState([]);
  const [activeTab, setActiveTab] = useState('standings');
  const [selectedSeason, setSelectedSeason] = useState('2024-2025');
  const [selectedWeek, setSelectedWeek] = useState(null);
  
  // Get new group info from navigation state
  const isNewGroup = location.state?.newGroup || false;
  const inviteCode = location.state?.inviteCode || '';
  const groupName = location.state?.groupName || '';

  // Use refs to prevent multiple fetch calls
  const hasFetched = useRef(false);

  useEffect(() => {
    const loadGroupData = async () => {
      try {
        if (!hasFetched.current && groupId) {
          console.log('Fetching group details for', groupId);
          
          await fetchGroupDetails(parseInt(groupId));
          const members = await fetchGroupMembers(parseInt(groupId));
          
          if (Array.isArray(members)) {
            setGroupMembers(members);
          }
          
          hasFetched.current = true;
        }
      } catch (err) {
        console.error('Error loading group data:', err);
      }
    };
    
    loadGroupData();
    
    // Reset the fetch flag when groupId changes
    return () => {
      if (groupId !== useParams().groupId) {
        hasFetched.current = false;
      }
    };
  }, [groupId, fetchGroupDetails, fetchGroupMembers]);

  if (loading && !currentGroup) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  if (!currentGroup && !isNewGroup) {
    return <ErrorMessage message="League not found" />;
  }

  // Use provided group data or new group data from navigation state
  const group = currentGroup || { 
    name: groupName, 
    invite_code: inviteCode,
    id: parseInt(groupId),
    tracked_teams: []
  };

  // Safe check for isAdmin function - avoid direct function call if not defined
  // This was potentially causing your React error
  const userIsAdmin = profile && group && profile.id && 
    typeof isAdmin === 'function' ? 
    isAdmin(parseInt(groupId), profile.id) : 
    (group.admin_id === profile?.id);

  return (
    <div className="p-6 space-y-6">
      {/* Group Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {group.name}
            </h1>
            <p className="text-gray-600">{group.league}</p>
            {group.description && (
              <p className="text-gray-600 mt-2">{group.description}</p>
            )}
          </div>
          <div className="space-y-2">
            {userIsAdmin && (
              <Link
                to={`/groups/${groupId}/manage`}
                className="inline-block px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Manage League
              </Link>
            )}
            <div className="text-sm text-gray-500 text-right">
              <p>Created: {new Date(group.created_at || Date.now()).toLocaleDateString()}</p>
              <p>Members: {group.member_count || groupMembers.length || 1}</p>
            </div>
          </div>
        </div>
        
        {/* Show Invite Code Banner for new groups */}
        {isNewGroup && inviteCode && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="font-semibold text-green-800 text-lg mb-2">League Created Successfully!</h3>
            <p className="text-green-700 mb-3">Share this invite code with friends to join your league:</p>
            <div className="bg-white p-3 rounded border flex justify-between items-center">
              <span className="font-mono text-lg font-bold tracking-wider">{inviteCode}</span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(inviteCode);
                  alert('Invite code copied to clipboard!');
                }}
                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Copy
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Tabs Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          <button
            onClick={() => setActiveTab('standings')}
            className={`py-4 px-6 font-medium text-sm border-b-2 ${
              activeTab === 'standings' 
                ? 'border-blue-500 text-blue-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Standings
          </button>
          <button
            onClick={() => setActiveTab('fixtures')}
            className={`py-4 px-6 font-medium text-sm border-b-2 ${
              activeTab === 'fixtures' 
                ? 'border-blue-500 text-blue-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Fixtures
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`py-4 px-6 font-medium text-sm border-b-2 ${
              activeTab === 'members' 
                ? 'border-blue-500 text-blue-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Members
          </button>
        </nav>
      </div>
      
      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow-md p-6">
        {activeTab === 'standings' && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">League Standings</h2>
            <LeagueTable 
              group={group}
              selectedSeason={selectedSeason}
              selectedWeek={selectedWeek}
              setSelectedSeason={setSelectedSeason}
              setSelectedWeek={setSelectedWeek}
            />
          </div>
        )}
        
        {activeTab === 'fixtures' && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Upcoming Fixtures</h2>
            <p className="text-gray-500 text-center py-12">
              League fixtures will appear here
            </p>
          </div>
        )}
        
        {activeTab === 'members' && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">League Members</h2>
            {groupMembers && groupMembers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Username
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Joined
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {groupMembers.map(member => (
                      <tr key={member.user_id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {member.username}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            {member.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {member.joined_at ? new Date(member.joined_at).toLocaleDateString() : 'Unknown'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-12">
                Only you are in this league right now. Share the invite code to add members!
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupDetailsPage;