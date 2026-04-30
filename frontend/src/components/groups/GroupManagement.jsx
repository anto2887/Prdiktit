import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGroups, useUser, useNotifications } from '../../contexts/AppContext';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import { useI18n } from '../../i18n';

const GroupManagement = () => {
  const { t } = useI18n();
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotifications();
  const { profile } = useUser();
  const { 
    currentGroup,
    setCurrentGroup,
    fetchGroupDetails,
    fetchGroupMembers,
    manageMember,
    regenerateInviteCode,
    loading,
    setLoading,
    error 
  } = useGroups();

  const [members, setMembers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(null);
  const [localLoading, setLocalLoading] = useState(false);

  const loadingRef = useRef(false);
  const mountedRef = useRef(false);
  const dataLoadedRef = useRef(false);

  const loadGroupData = async () => {
    if (loadingRef.current || dataLoadedRef.current) {
      process.env.NODE_ENV === 'development' && console.log('GroupManagement: Skipping load - already loading or loaded');
      return;
    }

    if (!profile || !groupId) {
      process.env.NODE_ENV === 'development' && console.log('GroupManagement: Missing profile or groupId', { profile: !!profile, groupId });
      return;
    }
    
    loadingRef.current = true;
    
    try {
      process.env.NODE_ENV === 'development' && console.log('Loading group details for:', groupId);
      process.env.NODE_ENV === 'development' && console.log('Current user profile:', profile);
      
      // Fetch group details first
      const groupDetails = await fetchGroupDetails(groupId);
      if (!groupDetails) {
        showError(t('groupManagement.failedLoadGroupDetails'));
        return;
      }
      
      process.env.NODE_ENV === 'development' && console.log('Group details loaded:', groupDetails);
      process.env.NODE_ENV === 'development' && console.log('Group admin_id:', groupDetails.admin_id);
      process.env.NODE_ENV === 'development' && console.log('Current user id:', profile.id);
      
      // FIXED: Better admin check with type conversion
      const isUserAdmin = parseInt(groupDetails.admin_id) === parseInt(profile.id);
      process.env.NODE_ENV === 'development' && console.log('Is user admin?', isUserAdmin);
      
      if (!isUserAdmin) {
        // FIXED: Also check if user has admin role in the group
        const userRole = groupDetails.role;
        process.env.NODE_ENV === 'development' && console.log('User role in group:', userRole);
        
        if (userRole !== 'ADMIN') {
          showError(t('groupManagement.notAuthorized'));
          navigate(`/groups/${groupId}`);
          return;
        }
      }
      
      process.env.NODE_ENV === 'development' && console.log('Fetching group members for:', groupId);
      
      // Fetch members
      const membersData = await fetchGroupMembers(groupId);
      process.env.NODE_ENV === 'development' && console.log('Received members data:', membersData);
      
      if (Array.isArray(membersData)) {
        // Separate approved and pending members
        const approvedMembers = membersData.filter(m => 
          !m.status || m.status === 'APPROVED'
        );
        const pendingMembers = membersData.filter(m => 
          m.status === 'PENDING'
        );
        
        process.env.NODE_ENV === 'development' && console.log('Approved members:', approvedMembers.length);
        process.env.NODE_ENV === 'development' && console.log('Pending members:', pendingMembers.length);
        
        setMembers(approvedMembers);
        setPendingRequests(pendingMembers);
      } else {
        process.env.NODE_ENV === 'development' && console.warn('Members data is not an array:', membersData);
        setMembers([]);
        setPendingRequests([]);
      }
      
      dataLoadedRef.current = true;
    } catch (err) {
      process.env.NODE_ENV === 'development' && console.error('GroupManagement: Error loading group data:', err);
      if (mountedRef.current) {
        showError(t('groupManagement.failedLoadData'));
      }
    } finally {
      if (mountedRef.current) {
        setLocalLoading(false);
      }
      loadingRef.current = false;
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    
    if (!dataLoadedRef.current) {
      loadGroupData();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [groupId, profile?.id]); // FIXED: Removed function dependencies to prevent infinite loop

  const reloadGroupData = async () => {
    if (loadingRef.current) return;
    
    loadingRef.current = true;
    setLocalLoading(true);
    
    try {
      // Reset data loaded flag to force fresh load
      dataLoadedRef.current = false;
      
      // Clear current data
      setMembers([]);
      setPendingRequests([]);
      
      // Reload data
      await loadGroupData();
    } catch (err) {
      process.env.NODE_ENV === 'development' && console.error('Error reloading group data:', err);
      showError(t('groupManagement.failedReloadData'));
    } finally {
      setLocalLoading(false);
      loadingRef.current = false;
    }
  };

  const handleMemberAction = async (userId, action) => {
    process.env.NODE_ENV === 'development' && console.log(`GroupManagement: Performing action ${action} on user ${userId}`);
    
    try {
      setLocalLoading(true);
      
      const success = await manageMember(groupId, userId, action);
      
      if (success) {
        showSuccess(t('groupManagement.memberActionSuccess'));
        await reloadGroupData();
      } else {
        showError(t('groupManagement.memberActionFailed'));
      }
    } catch (err) {
      process.env.NODE_ENV === 'development' && console.error('GroupManagement: Error managing member:', err);
      showError(t('groupManagement.memberActionFailed'));
    } finally {
      if (mountedRef.current) {
        setLocalLoading(false);
      }
    }
  };

  const handleRegenerateCode = async () => {
    if (!profile || localLoading) {
      return;
    }
    
    try {
      setLocalLoading(true);
      const response = await regenerateInviteCode(groupId);
      
      if (response && response.status === 'success') {
        showSuccess(t('groupManagement.regeneratedSuccess'));
        setShowRegenerateConfirm(false);
        
        if (response.data && response.data.new_code) {
          setCurrentGroup(prev => ({
            ...prev,
            invite_code: response.data.new_code
          }));
        }
      } else {
        throw new Error(response?.message || t('groupManagement.regeneratedFailed'));
      }
    } catch (err) {
      process.env.NODE_ENV === 'development' && console.error('GroupManagement: Error regenerating code:', err);
      showError(t('groupManagement.regeneratedFailed'));
    } finally {
      if (mountedRef.current) {
        setLocalLoading(false);
      }
    }
  };

  if (!profile) {
    return <ErrorMessage message={t('groupManagement.profileNotLoaded')} />;
  }

  if (loading || localLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!currentGroup) return <ErrorMessage message={t('groupManagement.groupNotFound')} />;
  
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Group Info Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {currentGroup.name}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">{currentGroup.league}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('groupManagement.created')}: {new Date(currentGroup.created_at).toLocaleDateString()}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('groups.members')}: {members.length}
            </p>
            {pendingRequests.length > 0 && (
              <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
                {t('groupManagement.pending')}: {pendingRequests.length}
              </p>
            )}
          </div>
        </div>

        {/* Invite Code Section */}
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-gray-700 dark:text-gray-300">{t('groupManagement.inviteCode')}</h3>
              <p className="text-xl font-mono mt-1 text-gray-900 dark:text-gray-100">{currentGroup.invite_code}</p>
            </div>
            <button
              onClick={() => setShowRegenerateConfirm(true)}
              disabled={localLoading}
              className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50"
            >
              {t('groupManagement.regenerateCode')}
            </button>
          </div>
        </div>
      </div>

      {/* Pending Requests Section */}
      {pendingRequests.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            {t('groupManagement.pendingRequests')} ({pendingRequests.length})
          </h2>
          <div className="space-y-4">
            {pendingRequests.map(request => (
              <div key={request.user_id} 
                   className="flex justify-between items-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{request.username}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('groupManagement.requested')}: {request.requested_at ? 
                      new Date(request.requested_at).toLocaleDateString() : 
                      t('history.tbd')}
                  </p>
                </div>
                <div className="space-x-2">
                  <button
                    onClick={() => handleMemberAction(request.user_id, 'APPROVE')}
                    disabled={localLoading}
                    className="px-4 py-2 bg-green-600 dark:bg-green-500 text-white rounded hover:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50"
                  >
                    {t('groupManagement.approve')}
                  </button>
                  <button
                    onClick={() => handleMemberAction(request.user_id, 'REJECT')}
                    disabled={localLoading}
                    className="px-4 py-2 bg-red-600 dark:bg-red-500 text-white rounded hover:bg-red-700 dark:hover:bg-red-600 disabled:opacity-50"
                  >
                    {t('groupManagement.reject')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Members List Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          {t('groups.members')} ({members.length})
        </h2>
        <div className="space-y-4">
          {members.map(member => (
            <div key={member.user_id} 
                 className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">{member.username}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('groupDetails.role')}: {member.role || 'MEMBER'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('groupDetails.joined')}: {member.joined_at ? 
                    new Date(member.joined_at).toLocaleDateString() : 
                    t('history.tbd')}
                </p>
              </div>
              {member.role !== 'ADMIN' && member.user_id !== currentGroup.admin_id && (
                <div className="space-x-2">
                  <button
                    onClick={() => setShowRemoveConfirm(member.user_id)}
                    disabled={localLoading}
                    className="px-4 py-2 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/40 disabled:opacity-50"
                  >
                    {t('groupManagement.remove')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Regenerate Code Confirmation Modal */}
      {showRegenerateConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-md w-full">
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">{t('groupManagement.regenerateConfirmTitle')}</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t('groupManagement.regenerateConfirmBody')}
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowRegenerateConfirm(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleRegenerateCode}
                disabled={localLoading}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50"
              >
                {t('groupManagement.regenerate')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Member Confirmation Modal */}
      {showRemoveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-md w-full">
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">{t('groupManagement.removeConfirmTitle')}</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t('groupManagement.removeConfirmBody')}
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowRemoveConfirm(null)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => {
                  handleMemberAction(showRemoveConfirm, 'REMOVE');
                  setShowRemoveConfirm(null);
                }}
                disabled={localLoading}
                className="px-4 py-2 bg-red-600 dark:bg-red-500 text-white rounded hover:bg-red-700 dark:hover:bg-red-600 disabled:opacity-50"
              >
                {t('groupManagement.remove')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupManagement;