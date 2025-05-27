// src/contexts/GroupContext.js
import React, { createContext, useContext, useState, useCallback } from 'react';
import { groupsApi } from '../api';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';

const GroupContext = createContext(null);

export const GroupProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { showSuccess, showError } = useNotifications();
  
  const [userGroups, setUserGroups] = useState([]);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [groupMembers, setGroupMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchUserGroups = useCallback(async () => {
    if (!isAuthenticated) return [];
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('GroupContext: Calling groupsApi.getUserGroups...');
      const response = await groupsApi.getUserGroups();
      console.log('GroupContext: getUserGroups response:', response);
      
      if (response && response.status === 'success') {
        // Handle both response.data as array and response.data.data as array
        const groups = response.data || [];
        console.log('GroupContext: Setting groups to:', groups);
        setUserGroups(groups);
        return groups;
      } else {
        console.warn('GroupContext: Non-success response:', response);
        setUserGroups([]);
        return [];
      }
    } catch (err) {
      console.error('GroupContext: Error in fetchUserGroups:', err);
      setError(err.message || 'Failed to fetch groups');
      
      // Don't show error immediately on page load - let DashboardPage handle it
      if (userGroups.length === 0) {
        console.log('GroupContext: Suppressing error notification on initial load');
      } else {
        showError(err.message || 'Failed to fetch groups');
      }
      
      setUserGroups([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, showError, userGroups.length]);

  const fetchGroupDetails = useCallback(async (groupId) => {
    if (!isAuthenticated || !groupId) return null;
    
    try {
      setLoading(true);
      setError(null);
      
      // Check if we already have this group loaded
      if (currentGroup && currentGroup.id === groupId) {
        console.log('Using cached group details for', groupId);
        setLoading(false);
        return currentGroup;
      }
      
      console.log('Fetching group details for', groupId);
      const response = await groupsApi.getGroupById(groupId);
      
      if (response.status === 'success') {
        setCurrentGroup(response.data);
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to fetch group details');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch group details');
      showError(err.message || 'Failed to fetch group details');
      return null;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, currentGroup, showError]);

  const fetchGroupMembers = useCallback(async (groupId) => {
    if (!isAuthenticated || !groupId) return [];
    
    try {
      setLoading(true);
      setError(null);
      
      // Check if we already have members for this group
      if (groupMembers.length > 0 && 
          currentGroup && 
          currentGroup.id === groupId) {
        console.log('Using cached group members for', groupId);
        setLoading(false);
        return groupMembers;
      }
      
      console.log('Fetching group members for', groupId);
      const response = await groupsApi.getGroupMembers(groupId);
      
      if (response.status === 'success') {
        setGroupMembers(response.data);
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to fetch group members');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch group members');
      showError(err.message || 'Failed to fetch group members');
      return [];
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, currentGroup, groupMembers, showError]);

  const fetchTeamsForLeague = useCallback(async (leagueId) => {
    if (!isAuthenticated || !leagueId) {
      setError("Missing league ID or not authenticated");
      return { status: 'error', data: [] };
    }
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching teams for league:', leagueId);
      const response = await groupsApi.fetchTeamsForLeague(leagueId);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('Teams API response:', response);
      }
      
      if (response && response.status === 'success') {
        return response;
      } else {
        throw new Error(response?.message || 'Failed to fetch teams');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch teams');
      showError(err.message || 'Failed to fetch teams');
      return { status: 'error', data: [] };
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, showError]);

  const createGroup = useCallback(async (groupData) => {
    if (!isAuthenticated) return null;
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('Creating group with data:', groupData);
      const response = await groupsApi.createGroup(groupData);
      console.log('Group creation API response:', response);
      
      if (response.status === 'success') {
        // Refresh groups list
        await fetchUserGroups();
        showSuccess('Group created successfully');
        return response;
      } else {
        throw new Error(response.message || 'Failed to create group');
      }
    } catch (err) {
      setError(err.message || 'Failed to create group');
      showError(err.message || 'Failed to create group');
      return null;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, fetchUserGroups, showSuccess, showError]);

  const updateGroup = useCallback(async (groupId, groupData) => {
    if (!isAuthenticated || !groupId) return null;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await groupsApi.updateGroup(groupId, groupData);
      
      if (response.status === 'success') {
        // Refresh group details
        await fetchGroupDetails(groupId);
        showSuccess('Group updated successfully');
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to update group');
      }
    } catch (err) {
      setError(err.message || 'Failed to update group');
      showError(err.message || 'Failed to update group');
      return null;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, fetchGroupDetails, showSuccess, showError]);

  const joinGroup = useCallback(async (inviteCode) => {
    if (!isAuthenticated) return null;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await groupsApi.joinGroup(inviteCode);
      
      if (response.status === 'success') {
        // Refresh groups list
        await fetchUserGroups();
        showSuccess('Successfully joined group');
        return true;
      } else {
        throw new Error(response.message || 'Failed to join group');
      }
    } catch (err) {
      setError(err.message || 'Failed to join group');
      showError(err.message || 'Failed to join group');
      return false;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, fetchUserGroups, showSuccess, showError]);

  const leaveGroup = useCallback(async (groupId) => {
    if (!isAuthenticated || !groupId) return false;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await groupsApi.leaveGroup(groupId);
      
      if (response.status === 'success') {
        // Refresh groups list
        await fetchUserGroups();
        showSuccess('Successfully left group');
        return true;
      } else {
        throw new Error(response.message || 'Failed to leave group');
      }
    } catch (err) {
      setError(err.message || 'Failed to leave group');
      showError(err.message || 'Failed to leave group');
      return false;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, fetchUserGroups, showSuccess, showError]);

  const manageMember = useCallback(async (groupId, userId, action) => {
    if (!isAuthenticated || !groupId) return false;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await groupsApi.manageMember(groupId, userId, action);
      
      if (response.status === 'success') {
        // Refresh group members
        await fetchGroupMembers(groupId);
        showSuccess('Member action completed successfully');
        return true;
      } else {
        throw new Error(response.message || 'Failed to perform member action');
      }
    } catch (err) {
      setError(err.message || 'Failed to perform member action');
      showError(err.message || 'Failed to perform member action');
      return false;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, fetchGroupMembers, showSuccess, showError]);

  const regenerateInviteCode = useCallback(async (groupId) => {
    if (!isAuthenticated || !groupId) return null;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await groupsApi.regenerateInviteCode(groupId);
      
      if (response.status === 'success') {
        // Refresh group details
        await fetchGroupDetails(groupId);
        showSuccess('Invite code regenerated successfully');
        return response;
      } else {
        throw new Error(response.message || 'Failed to regenerate invite code');
      }
    } catch (err) {
      setError(err.message || 'Failed to regenerate invite code');
      showError(err.message || 'Failed to regenerate invite code');
      return null;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, fetchGroupDetails, showSuccess, showError]);

  const isAdmin = useCallback((groupId, userId) => {
    if (!groupId || !userId) {
      console.log('isAdmin: Missing groupId or userId', { groupId, userId });
      return false;
    }
    
    // Convert to numbers for comparison
    const numericGroupId = parseInt(groupId);
    const numericUserId = parseInt(userId);
    
    console.log('isAdmin check:', { numericGroupId, numericUserId });
    
    // First check the current group if it's loaded
    if (currentGroup && currentGroup.id === numericGroupId) {
      const isCurrentGroupAdmin = currentGroup.admin_id === numericUserId;
      console.log('isAdmin (currentGroup):', { 
        currentGroupAdmin: currentGroup.admin_id, 
        userId: numericUserId, 
        isAdmin: isCurrentGroupAdmin 
      });
      return isCurrentGroupAdmin;
    }
    
    // Otherwise check userGroups
    const group = userGroups.find(g => g.id === numericGroupId);
    if (!group) {
      console.log('isAdmin: Group not found in userGroups', { numericGroupId, userGroups });
      return false;
    }
    
    const isGroupAdmin = group.admin_id === numericUserId;
    console.log('isAdmin (userGroups):', { 
      groupAdmin: group.admin_id, 
      userId: numericUserId, 
      isAdmin: isGroupAdmin 
    });
    
    return isGroupAdmin;
  }, [currentGroup, userGroups]);

  const isMember = useCallback((groupId) => {
    if (!groupId) return false;
    return userGroups.some(g => g.id === groupId);
  }, [userGroups]);

  const clearGroupData = useCallback(() => {
    setUserGroups([]);
    setCurrentGroup(null);
    setGroupMembers([]);
    setError(null);
  }, []);

  return (
    <GroupContext.Provider
      value={{
        userGroups,
        currentGroup,
        groupMembers,
        loading,
        error,
        fetchUserGroups,
        fetchGroupDetails,
        fetchGroupMembers,
        createGroup,
        updateGroup,
        joinGroup,
        leaveGroup,
        manageMember,
        isAdmin,
        isMember,
        clearGroupData,
        fetchTeamsForLeague,
        regenerateInviteCode,
        setCurrentGroup
      }}
    >
      {children}
    </GroupContext.Provider>
  );
};

export const useGroups = () => {
  const context = useContext(GroupContext);
  if (!context) {
    throw new Error('useGroups must be used within a GroupProvider');
  }
  return context;
};

export default GroupContext;