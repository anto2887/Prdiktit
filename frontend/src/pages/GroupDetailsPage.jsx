// src/pages/GroupDetailsPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useGroups } from '../contexts/GroupContext';
import { useUser } from '../contexts/UserContext';

// Components
import LeagueTable from '../components/dashboard/LeagueTable';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';

const GroupDetailsPage = () => {
  const { groupId } = useParams();
  const { 
    currentGroup, 
    fetchGroupDetails, 
    fetchGroupMembers, 
    isAdmin,
    loading, 
    error 
  } = useGroups();
  const { profile } = useUser();
  const [activeTab, setActiveTab] = useState('standings');

  useEffect(() => {
    if (groupId) {
      fetchGroupDetails(parseInt(groupId));
      fetchGroupMembers(parseInt(groupId));
    }
  }, [groupId, fetchGroupDetails, fetchGroupMembers]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  if (!currentGroup) {
    return <ErrorMessage message="League not found" />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Group Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {currentGroup.name}
            </h1>
            <p className="text-gray-600">{currentGroup.league}</p>
            {currentGroup.description && (
              <p className="text-gray-600 mt-2">{currentGroup.description}</p>
            )}
          </div>
          <div className="space-y-2">
            {isAdmin(currentGroup.id, profile?.id) && (
              <Link
                to={`/groups/${groupId}/manage`}
                className="inline-block px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Manage League
              </Link>
            )}
            <div className="text-sm text-gray-500 text-right">
              <p>Created: {new Date(currentGroup.created_at).toLocaleDateString()}</p>
              <p>Members: {currentGroup.member_count}</p>
            </div>
          </div>
        </div>
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
            <LeagueTable group={currentGroup} />
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
            {currentGroup.members && currentGroup.members.length > 0 ? (
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
                    {currentGroup.members.map(member => (
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
                          {new Date(member.joined_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-12">
                No members found
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupDetailsPage;