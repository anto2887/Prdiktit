// src/pages/GroupsPage.jsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGroups } from '../contexts/GroupContext';

// Components
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';

const GroupsPage = () => {
  const { userGroups, fetchUserGroups, loading, error } = useGroups();

  useEffect(() => {
    fetchUserGroups();
  }, [fetchUserGroups]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">My Leagues</h1>
        <div className="space-x-4">
          <Link
            to="/groups/join"
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Join League
          </Link>
          <Link
            to="/groups/create"
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Create League
          </Link>
        </div>
      </div>

      {userGroups.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            You're not in any leagues yet
          </h3>
          <p className="text-gray-500 mb-4">
            Join a league to start making predictions
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {userGroups.map(group => (
            <div key={group.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">
                  {group.name}
                </h3>
                <p className="text-sm text-gray-500">
                  {group.league}
                </p>
              </div>
              <div className="px-6 py-4 bg-gray-50">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">
                    {group.member_count} members
                  </span>
                  <Link
                    to={`/groups/${group.id}`}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    View League →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GroupsPage;