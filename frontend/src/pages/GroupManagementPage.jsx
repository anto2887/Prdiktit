// src/pages/GroupManagementPage.jsx
import React, { useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useGroups } from '../contexts/GroupContext';
import { useUser } from '../contexts/UserContext';

// Components
import GroupManagement from '../components/groups/GroupManagement';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';

const GroupManagementPage = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { 
    currentGroup, 
    fetchGroupDetails,
    isAdmin,
    loading, 
    error 
  } = useGroups();
  const { profile } = useUser();

  useEffect(() => {
    if (groupId) {
      fetchGroupDetails(parseInt(groupId));
    }
  }, [groupId, fetchGroupDetails]);

  useEffect(() => {
    // Redirect if user is not admin of this group
    if (currentGroup && profile && !isAdmin(currentGroup.id, profile.id)) {
      navigate(`/groups/${groupId}`);
    }
  }, [currentGroup, profile, groupId, isAdmin, navigate]);

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
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Manage League: {currentGroup.name}</h1>
        <Link
          to={`/groups/${groupId}`}
          className="text-blue-600 hover:text-blue-800"
        >
          ← Back to League
        </Link>
      </div>
      
      <GroupManagement />
    </div>
  );
};

export default GroupManagementPage;