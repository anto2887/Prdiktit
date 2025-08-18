import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useGroups, useNotifications } from '../../contexts/AppContext';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';

const AdminDashboard = () => {
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(null);
  const { groupId } = useParams();
  const { showSuccess, showError } = useNotifications();
  const { 
    currentGroup,
    fetchGroupDetails,
    fetchGroupMembers,
    manageMember,
    regenerateInviteCode,
    loading,
    error 
  } = useGroups();

  const [members, setMembers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);

  useEffect(() => {
    if (groupId) {
      loadGroupData();
    }
  }, [groupId]);

  const loadGroupData = async () => {
    try {
      await fetchGroupDetails(groupId);
      const membersData = await fetchGroupMembers(groupId);
      setMembers(membersData.filter(m => m.status === 'APPROVED'));
      setPendingRequests(membersData.filter(m => m.status === 'PENDING'));
    } catch (err) {
      // Only show error notification if we're not in initial loading phase
      // This prevents the brief error flash when navigating to group pages
      if (currentGroup) {
        showError('Failed to load group data');
      }
    }
  };

  const handleMemberAction = async (userId, action) => {
    try {
      const success = await manageMember(groupId, userId, action);
      if (success) {
        showSuccess(`Successfully ${action.toLowerCase()}ed member`);
        loadGroupData(); // Refresh member list
      }
    } catch (err) {
      showError(`Failed to ${action.toLowerCase()} member`);
    }
  };

  const handleRegenerateCode = async () => {
    try {
      const newCode = await regenerateInviteCode(groupId);
      if (newCode) {
        showSuccess('Successfully regenerated invite code');
        setShowRegenerateConfirm(false);
      }
    } catch (err) {
      showError('Failed to regenerate invite code');
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!currentGroup) return <ErrorMessage message="Group not found" />;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Group Info Section */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {currentGroup.name}
            </h1>
            <p className="text-gray-600">{currentGroup.league}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">
              Created: {new Date(currentGroup.created_at).toLocaleDateString()}
            </p>
            <p className="text-sm text-gray-500">
              Members: {members.length}
            </p>
          </div>
        </div>

        {/* Invite Code Section */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-gray-700">Invite Code</h3>
              <p className="text-xl font-mono mt-1">{currentGroup.invite_code}</p>
            </div>
            <button
              onClick={() => setShowRegenerateConfirm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Regenerate Code
            </button>
          </div>
        </div>
      </div>

      {/* Pending Requests Section */}
      {pendingRequests.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Pending Requests ({pendingRequests.length})
          </h2>
          <div className="space-y-4">
            {pendingRequests.map(request => (
              <div key={request.user_id} 
                   className="flex justify-between items-center p-4 bg-yellow-50 rounded-lg">
                <div>
                  <p className="font-medium">{request.username}</p>
                  <p className="text-sm text-gray-500">
                    Requested: {new Date(request.requested_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="space-x-2">
                  <button
                    onClick={() => handleMemberAction(request.user_id, 'APPROVE')}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleMemberAction(request.user_id, 'REJECT')}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Members List Section */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Members ({members.length})
        </h2>
        <div className="space-y-4">
          {members.map(member => (
            <div key={member.user_id} 
                 className="flex justify-between items-center p-4 border-b">
              <div>
                <p className="font-medium">{member.username}</p>
                <p className="text-sm text-gray-500">
                  Joined: {new Date(member.joined_at).toLocaleDateString()}
                </p>
              </div>
              {member.role !== 'ADMIN' && (
                <div className="space-x-2">
                  <button
                    onClick={() => handleMemberAction(member.user_id, 'REMOVE')}
                    className="px-4 py-2 bg-red-100 text-red-600 rounded hover:bg-red-200"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Regenerate Code Confirmation Modal */}
      {showRegenerateConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Regenerate Invite Code?</h3>
            <p className="text-gray-600 mb-6">
              This will invalidate the current invite code. Users will need the new code to join the group.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowRegenerateConfirm(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleRegenerateCode}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;