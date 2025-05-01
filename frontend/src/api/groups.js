// src/api/groups.js
import { api } from './client';

/**
 * Get user's groups
 * @returns {Promise<Object>} User's groups
 */
export const getUserGroups = async () => {
  try {
    return await api.get('/groups');
  } catch (error) {
    console.error('Error fetching user groups:', error);
    return { status: 'success', data: [] };
  }
};

/**
 * Get group by ID
 * @param {number} groupId - Group ID
 * @returns {Promise<Object>} Group details
 */
export const getGroupById = async (groupId) => {
  return await api.get(`/groups/${groupId}`);
};

/**
 * Create a new group
 * @param {Object} groupData - Group data
 * @param {string} groupData.name - Group name
 * @param {string} groupData.league - League name
 * @param {string} [groupData.description] - Group description
 * @param {string} [groupData.privacy_type] - Privacy type
 * @param {Array<number>} [groupData.tracked_teams] - Tracked team IDs
 * @returns {Promise<Object>} Created group
 */
export const createGroup = async (groupData) => {
  return await api.post('/groups', groupData);
};

/**
 * Update an existing group
 * @param {number} groupId - Group ID
 * @param {Object} groupData - Updated group data
 * @returns {Promise<Object>} Updated group
 */
export const updateGroup = async (groupId, groupData) => {
  return await api.put(`/groups/${groupId}`, groupData);
};

/**
 * Join a group using invite code
 * @param {string} inviteCode - Group invite code
 * @returns {Promise<Object>} Join response
 */
export const joinGroup = async (inviteCode) => {
  return await api.post('/groups/join', { invite_code: inviteCode });
};

/**
 * Leave a group
 * @param {number} groupId - Group ID
 * @returns {Promise<Object>} Leave response
 */
export const leaveGroup = async (groupId) => {
  return await api.post(`/groups/${groupId}/leave`);
};

/**
 * Get group members
 * @param {number} groupId - Group ID
 * @returns {Promise<Object>} Group members
 */
export const getGroupMembers = async (groupId) => {
  return await api.get(`/groups/${groupId}/members`);
};

/**
 * Manage group members (add/remove/change roles)
 * @param {number} groupId - Group ID
 * @param {number} userId - User ID to perform action on
 * @param {string} action - Action type (APPROVE, REJECT, PROMOTE, DEMOTE, REMOVE)
 * @returns {Promise<Object>} Action result
 */
export const manageMember = async (groupId, userId, action) => {
  return await api.post(`/groups/${groupId}/members`, {
    user_ids: [userId],
    action: action
  });
};

/**
 * Regenerate group invite code
 * @param {number} groupId - Group ID
 * @returns {Promise<Object>} New invite code
 */
export const regenerateInviteCode = async (groupId) => {
  return await api.post(`/groups/${groupId}/regenerate-code`);
};

/**
 * Get group analytics
 * @param {number} groupId - Group ID
 * @param {Object} params - Query parameters
 * @param {string} [params.period] - Time period (weekly, monthly, all)
 * @returns {Promise<Object>} Group analytics
 */
export const getGroupAnalytics = async (groupId, params = {}) => {
  // Convert params object to query string
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, value);
    }
  });
  
  const queryString = queryParams.toString();
  const endpoint = queryString 
    ? `/groups/${groupId}/analytics?${queryString}` 
    : `/groups/${groupId}/analytics`;
  
  return await api.get(endpoint);
};

/**
 * Get teams for a specific league
 * @param {string} leagueId - League ID
 * @returns {Promise<Object>} Teams data
 */
export const fetchTeamsForLeague = async (leagueId) => {
  try {
    console.log('Fetching teams for league:', leagueId);
    return await api.get(`/groups/teams`, { 
      params: { league: leagueId }
    });
  } catch (error) {
    console.error('Error fetching teams:', error);
    // Return a proper structure even on error to avoid crashes
    return { 
      status: 'success', 
      data: [] 
    };
  }
};

/**
 * Get group audit logs
 * @param {number} groupId - Group ID
 * @param {number} [limit=20] - Maximum number of logs to retrieve
 * @returns {Promise<Object>} Audit logs
 */
export const getGroupAuditLogs = async (groupId, limit = 20) => {
  return await api.get(`/groups/${groupId}/audit-logs?limit=${limit}`);
};