// src/utils/dateHelpers.js

/**
 * Get the week number for a given date within a football season
 * @param {Date|string} date - The date to get week number for
 * @param {string} season - Season string (e.g., "2024-2025")
 * @returns {number} Week number (1-38 for Premier League)
 */
export const getWeekNumber = (date, season = "2024-2025") => {
  const matchDate = new Date(date);
  const seasonStart = getSeasonStartDate(season);
  
  if (matchDate < seasonStart) return 0;
  
  // Calculate weeks since season start
  const weeksSinceStart = Math.floor((matchDate - seasonStart) / (7 * 24 * 60 * 60 * 1000));
  
  // Premier League typically has 38 gameweeks
  return Math.min(Math.max(1, weeksSinceStart + 1), 38);
};

/**
 * Get all week numbers for a given season
 * @param {string} season - Season string (e.g., "2024-2025")
 * @returns {number[]} Array of week numbers [1, 2, ..., 38]
 */
export const getSeasonWeeks = (season = "2024-2025") => {
  return Array.from({ length: 38 }, (_, i) => i + 1);
};

/**
 * Check if a date falls within a specific week of a season
 * @param {Date|string} date - Date to check
 * @param {number} weekNumber - Week number to check against
 * @param {string} season - Season string
 * @returns {boolean} True if date is in the specified week
 */
export const isDateInWeek = (date, weekNumber, season = "2024-2025") => {
  return getWeekNumber(date, season) === weekNumber;
};

/**
 * Get the start date for a football season
 * @param {string} season - Season string (e.g., "2024-2025")
 * @returns {Date} Season start date
 */
export const getSeasonStartDate = (season = "2024-2025") => {
  // Map season strings to their start dates
  const seasonStartDates = {
    "2024-2025": new Date("2024-08-17"), // Premier League 2024-25 start
    "2023-2024": new Date("2023-08-12"), // Premier League 2023-24 start
    "2025-2026": new Date("2025-08-16"), // Estimated future start
  };
  
  return seasonStartDates[season] || seasonStartDates["2024-2025"];
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
 * Format a week number for display
 * @param {number} weekNumber - Week number
 * @returns {string} Formatted week string
 */
export const formatWeekDisplay = (weekNumber) => {
  if (weekNumber === 0) return "Pre-season";
  if (weekNumber > 38) return "Post-season";
  return `Week ${weekNumber}`;
}; 