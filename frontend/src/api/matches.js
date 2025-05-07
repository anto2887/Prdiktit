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
  try {
    // Handle date formatting issue - convert to YYYY-MM-DD format
    if (params.from) {
      if (params.from instanceof Date) {
        params.from = params.from.toISOString().split('T')[0];
      } else if (typeof params.from === 'string' && params.from.includes('T')) {
        params.from = params.from.split('T')[0];
      }
    }
    
    if (params.to) {
      if (params.to instanceof Date) {
        params.to = params.to.toISOString().split('T')[0];
      } else if (typeof params.to === 'string' && params.to.includes('T')) {
        params.to = params.to.split('T')[0];
      }
    }
    
    // Ensure all params are strings for consistency
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined) {
        params[key] = String(params[key]);
      }
    });
    
    const response = await api.get('/matches/fixtures', { params });
    return response;
  } catch (error) {
    console.error('Error fetching fixtures:', error);
    // Return a structured response even on error
    return { 
      status: 'success', 
      matches: [], 
      total: 0 
    };
  }
};

/**
 * Get fixtures for a specific league
 * @param {number} leagueId - League ID
 * @param {string} season - Season
 * @returns {Promise<Object>} League fixtures data
 */
export const getLeagueFixtures = async (leagueId, season) => {
  return await api.get('/matches/fixtures', { 
    params: { league: leagueId, season }
  });
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