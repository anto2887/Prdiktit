// src/utils/dateHelpers.js

/**
 * Get the week number for a given date within a season
 * @param {Date} date - Date to check
 * @param {string} season - Season string (e.g., "2025-2026")
 * @returns {number} Week number (1-38 for Premier League)
 */
export const getWeekNumber = (date, season = null) => {
  if (!season) {
    season = getCurrentSeason();
  }
  
  const seasonStart = getSeasonStartDate(season);
  const timeDiff = date.getTime() - seasonStart.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
  
  if (daysDiff < 0) return 0; // Before season starts
  if (daysDiff > 266) return 39; // After season ends (38 weeks + buffer)
  
  return Math.floor(daysDiff / 7) + 1;
};

/**
 * Get the total number of weeks in a season
 * @param {string} season - Season string (e.g., "2025-2026")
 * @returns {number} Total weeks in season
 */
export const getSeasonWeeks = (season = null) => {
  if (!season) {
    season = getCurrentSeason();
  }
  
  // Premier League has 38 weeks, but we'll make this configurable
  const seasonWeeks = {
    "2025-2026": 38,
    "2024-2025": 38,
    "2023-2024": 38,
  };
  
  return seasonWeeks[season] || 38;
};

/**
 * Check if a date falls within a specific week of a season
 * @param {Date} date - Date to check
 * @param {number} weekNumber - Week number to check
 * @param {string} season - Season string (e.g., "2025-2026")
 * @returns {boolean} True if date is in the specified week
 */
export const isDateInWeek = (date, weekNumber, season = null) => {
  if (!season) {
    season = getCurrentSeason();
  }
  
  return getWeekNumber(date, season) === weekNumber;
};

/**
 * Get the current season based on the current date
 * @returns {string} Current season string
 */
export const getCurrentSeason = () => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-based
  
  // If it's before August, we're in the previous season
  if (currentMonth < 7) { // Before August
    return `${currentYear - 1}-${currentYear}`;
  } else {
    return `${currentYear}-${currentYear + 1}`;
  }
};

/**
 * Get season start dates for different seasons
 */
export const getSeasonStartDate = (season = null) => {
  const seasonStartDates = {
    "2025-2026": new Date("2025-08-17"), // Premier League 2025-26 start
    "2024-2025": new Date("2024-08-17"), // Premier League 2024-25 start
    "2023-2024": new Date("2023-08-12"), // Premier League 2023-24 start
  };
  
  // If no season provided, use current season
  if (!season) {
    season = getCurrentSeason();
  }
  
  return seasonStartDates[season] || seasonStartDates["2025-2026"];
};

/**
 * Format a week number for display
 * @param {number} weekNumber - Week number
 * @returns {string} Formatted week string
 */
export const formatWeekDisplay = (weekNumber) => {
  if (weekNumber === 0) return "Pre-season";
  if (weekNumber > 38) return "Post-season";
  return `Week ${weekNumber}`;
}; 