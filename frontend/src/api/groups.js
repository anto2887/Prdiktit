import { handleApiError, getDefaultHeaders, formatQueryParams } from './utils';

const BASE_URL = '/api/groups';

/**
 * Create a new group
 * @param {Object} groupData - Group creation data
 * @param {string} groupData.name - Group name
 * @param {string} groupData.league - League name
 * @param {string} [groupData.privacy_type] - Privacy type (default: 'PRIVATE')
 * @param {string} [groupData.description] - Group description
 * @param {Array<number>} [groupData.tracked_teams] - Array of team IDs to track
 * @returns {Promise<Object>} Created group data
 */
export const createGroup = async (groupData) => {
  try {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: getDefaultHeaders(),
      body: JSON.stringify(groupData),
      credentials: 'include',
    });

    if (!response.ok) {
      throw await handleApiError(response);
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
};

/**
 * Get user's groups
 * @returns {Promise<Object>} List of user's groups
 */
export const getGroups = async () => {
  try {
    const response = await fetch(BASE_URL, {
      headers: getDefaultHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      throw await handleApiError(response);
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
};

/**
 * Get group details by ID
 * @param {number} groupId - Group ID
 * @returns {Promise<Object>} Group details
 */
export const getGroupById = async (groupId) => {
  try {
    const response = await fetch(`${BASE_URL}/${groupId}`, {
      headers: getDefaultHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      throw await handleApiError(response);
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
};

/**
 * Update group details
 * @param {number} groupId - Group ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated group data
 */
export const updateGroup = async (groupId, updateData) => {
  try {
    const response = await fetch(`${BASE_URL}/${groupId}`, {
      method: 'PUT',
      headers: getDefaultHeaders(),
      body: JSON.stringify(updateData),
      credentials: 'include',
    });

    if (!response.ok) {
      throw await handleApiError(response);
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
};

/**
 * Join a group using invite code
 * @param {string} inviteCode - Group invite code
 * @returns {Promise<Object>} Join response
 */
export const joinGroup = async (inviteCode) => {
  try {
    const response = await fetch(`${BASE_URL}/join`, {
      method: 'POST',
      headers: getDefaultHeaders(),
      body: JSON.stringify({ invite_code: inviteCode }),
      credentials: 'include',
    });

    if (!response.ok) {
      throw await handleApiError(response);
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
};

/**
 * Get group members
 * @param {number} groupId - Group ID
 * @returns {Promise<Object>} Group members data
 */
export const getGroupMembers = async (groupId) => {
  try {
    const response = await fetch(`${BASE_URL}/${groupId}/members`, {
      headers: getDefaultHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      throw await handleApiError(response);
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
};

/**
 * Manage group members (add/remove/change roles)
 * @param {number} groupId - Group ID
 * @param {string} action - Action to perform
 * @param {Array<number>} userIds - Array of user IDs
 * @returns {Promise<Object>} Action result
 */
export const manageMembers = async (groupId, action, userIds) => {
  try {
    const response = await fetch(`${BASE_URL}/${groupId}/members`, {
      method: 'POST',
      headers: getDefaultHeaders(),
      body: JSON.stringify({
        action,
        user_ids: userIds,
      }),
      credentials: 'include',
    });

    if (!response.ok) {
      throw await handleApiError(response);
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
};

/**
 * Remove a member from the group
 * @param {number} groupId - Group ID
 * @param {number} userId - User ID to remove
 * @returns {Promise<Object>} Remove response
 */
export const removeMember = async (groupId, userId) => {
  try {
    const response = await fetch(`${BASE_URL}/${groupId}/members/${userId}`, {
      method: 'DELETE',
      headers: getDefaultHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      throw await handleApiError(response);
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
};

/**
 * Regenerate group invite code
 * @param {number} groupId - Group ID
 * @returns {Promise<Object>} New invite code
 */
export const regenerateInviteCode = async (groupId) => {
  try {
    const response = await fetch(`${BASE_URL}/${groupId}/regenerate-code`, {
      method: 'POST',
      headers: getDefaultHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      throw await handleApiError(response);
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
};