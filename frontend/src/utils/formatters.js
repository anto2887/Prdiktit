// src/utils/formatters.js

/**
 * Format a number as a score
 * @param {number|null|undefined} score - Score to format
 * @returns {string} Formatted score
 */
export const formatScore = (score) => {
    if (score === null || score === undefined) return '-';
    return score.toString();
  };
  
  /**
   * Format points with suffix
   * @param {number} points - Points to format
   * @returns {string} Formatted points with suffix
   */
  export const formatPoints = (points) => {
    if (points === 1) return '1 point';
    return `${points} points`;
  };
  
  /**
   * Format a percentage value
   * @param {number} value - Value to format as percentage
   * @param {number} [precision=1] - Decimal precision
   * @returns {string} Formatted percentage
   */
  export const formatPercentage = (value, precision = 1) => {
    if (value === null || value === undefined) return 'N/A';
    return `${value.toFixed(precision)}%`;
  };
  
  /**
   * Truncate a string if it exceeds maxLength
   * @param {string} str - String to truncate
   * @param {number} [maxLength=50] - Maximum length
   * @returns {string} Truncated string
   */
  export const truncateString = (str, maxLength = 50) => {
    if (!str) return '';
    if (str.length <= maxLength) return str;
    return `${str.substring(0, maxLength)}...`;
  };
  
  /**
   * Format a match result
   * @param {number} homeScore - Home team score
   * @param {number} awayScore - Away team score
   * @returns {string} Formatted result
   */
  export const formatMatchResult = (homeScore, awayScore) => {
    if (homeScore === null || awayScore === null) return 'vs';
    return `${homeScore} - ${awayScore}`;
  };
  
  /**
   * Format a prediction result status
   * @param {object} prediction - Prediction object with scores and points
   * @returns {string} Result status (correct, partial, incorrect)
   */
  export const formatPredictionStatus = (prediction) => {
    if (!prediction || prediction.points === undefined) return 'pending';
    
    if (prediction.points === 3) return 'correct';
    if (prediction.points === 1) return 'partial';
    return 'incorrect';
  };
  
  /**
   * Format a team name (truncate if too long)
   * @param {string} teamName - Team name to format
   * @param {number} [maxLength=20] - Maximum length
   * @returns {string} Formatted team name
   */
  export const formatTeamName = (teamName, maxLength = 20) => {
    return truncateString(teamName, maxLength);
  };
  
  /**
   * Format a match status into a user-friendly string
   * @param {string} status - Match status
   * @returns {string} Formatted status
   */
  export const formatMatchStatus = (status) => {
    const statusMap = {
      'NOT_STARTED': 'Not Started',
      'FIRST_HALF': '1st Half',
      'HALFTIME': 'Half Time',
      'SECOND_HALF': '2nd Half',
      'EXTRA_TIME': 'Extra Time',
      'PENALTY': 'Penalties',
      'FINISHED': 'Finished',
      'FINISHED_AET': 'Finished AET',
      'FINISHED_PEN': 'Finished Pen',
      'BREAK_TIME': 'Break',
      'SUSPENDED': 'Suspended',
      'INTERRUPTED': 'Interrupted',
      'POSTPONED': 'Postponed',
      'CANCELLED': 'Cancelled',
      'ABANDONED': 'Abandoned',
      'TECHNICAL_LOSS': 'Technical Loss',
      'WALKOVER': 'Walkover',
      'LIVE': 'Live'
    };
  
    return statusMap[status] || status;
  };
  
  /**
   * Format a number with thousand separators
   * @param {number} value - Number to format
   * @returns {string} Formatted number
   */
  export const formatNumber = (value) => {
    if (value === null || value === undefined) return 'N/A';
    return value.toLocaleString();
  };
  
  /**
   * Format a user role
   * @param {string} role - Role to format
   * @returns {string} Formatted role
   */
  export const formatUserRole = (role) => {
    const roleMap = {
      'ADMIN': 'Admin',
      'MODERATOR': 'Moderator',
      'MEMBER': 'Member'
    };
  
    return roleMap[role] || role;
  };

/**
 * Format a prediction object for display
 * @param {object} prediction - Prediction object with score1, score2, or prediction field
 * @returns {string} Formatted prediction string
 */
export const formatPrediction = (prediction) => {
  if (!prediction) return 'No prediction';
  
  // Handle different prediction formats
  if (prediction.score1 !== undefined && prediction.score2 !== undefined) {
    return `${prediction.score1} - ${prediction.score2}`;
  }
  
  if (prediction.prediction) {
    return prediction.prediction;
  }
  
  if (typeof prediction === 'string') {
    return prediction;
  }
  
  return 'Invalid prediction';
};