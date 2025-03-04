import { handleApiError, getDefaultHeaders, formatQueryParams } from './utils';

const BASE_URL = '/api/matches';

/**
 * Get live matches
 * @returns {Promise<Object>} Live matches data
 */
export const getLiveMatches = async () => {
  try {
    const response = await fetch(`${BASE_URL}/live`, {
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
 * Get match by ID
 * @param {number} matchId - Match ID
 * @returns {Promise<Object>} Match data
 */
export const getMatchById = async (matchId) => {
  try {
    const response = await fetch(`${BASE_URL}/${matchId}`, {
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
 * Get fixtures with optional filters
 * @param {Object} params - Query parameters
 * @param {string} [params.league] - League name
 * @param {string} [params.season] - Season
 * @param {string} [params.status] - Match status
 * @param {string} [params.from] - Start date (ISO format)
 * @param {string} [params.to] - End date (ISO format)
 * @returns {Promise<Object>} Fixtures data
 */
export const getFixtures = async (params = {}) => {
  try {
    const queryString = formatQueryParams(params);
    const response = await fetch(`${BASE_URL}/fixtures${queryString}`, {
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
 * Get fixtures for a specific league
 * @param {number} leagueId - League ID
 * @param {string} season - Season
 * @returns {Promise<Object>} League fixtures data
 */
export const getLeagueFixtures = async (leagueId, season) => {
  try {
    const params = new URLSearchParams({ league: leagueId, season });
    const response = await fetch(`${BASE_URL}/fixtures?${params}`, {
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
 * Get all possible match statuses
 * @returns {Promise<Object>} Match statuses
 */
export const getMatchStatuses = async () => {
  try {
    const response = await fetch(`${BASE_URL}/statuses`, {
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