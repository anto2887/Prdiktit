// src/api/matches.js
import { api } from './client';

/**
 * Get live matches
 * @returns {Promise<Object>} Live matches data
 */
export const getLiveMatches = async () => {
  return await api.get('/matches/live');
};

/**
 * Get match by ID
 * @param {number} matchId - Match ID
 * @returns {Promise<Object>} Match data
 */
export const getMatchById = async (matchId) => {
  return await api.get(`/matches/${matchId}`);
};

/**
 * Get fixtures with optional filters
 * @param {Object} params - Query parameters
 * @param {string} [params.league] - League name
 * @param {string} [params.season] - Season
 * @param {string} [params.status] - Match status
 * @param {string} [params.from] - Start date (ISO format)
 * @param {string} [params.to] - End date (ISO format)
 * @param {number} [params.team_id] - Team ID
 * @returns {Promise<Object>} Fixtures data
 */
export const getFixtures = async (params = {}) => {
  // Convert params object to query string
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, value);
    }
  });
  
  const queryString = queryParams.toString();
  const endpoint = queryString ? `/matches/fixtures?${queryString}` : '/matches/fixtures';
  
  return await api.get(endpoint);
};

/**
 * Get fixtures for a specific league
 * @param {number} leagueId - League ID
 * @param {string} season - Season
 * @returns {Promise<Object>} League fixtures data
 */
export const getLeagueFixtures = async (leagueId, season) => {
  return await api.get(`/matches/fixtures?league=${leagueId}&season=${season}`);
};

/**
 * Get all possible match statuses
 * @returns {Promise<Object>} Match statuses
 */
export const getMatchStatuses = async () => {
  return await api.get('/matches/statuses');
};

/**
 * Get upcoming matches
 * @returns {Promise<Object>} Upcoming matches
 */
export const getUpcomingMatches = async () => {
  return await api.get('/matches/upcoming');
};

/**
 * Get top matches for the week
 * @param {number} [count=5] - Number of matches to return
 * @returns {Promise<Object>} Top matches
 */
export const getTopMatches = async (count = 5) => {
  return await api.get(`/matches/top?count=${count}`);
};