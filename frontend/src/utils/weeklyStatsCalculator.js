// src/utils/weeklyStatsCalculator.js
import { getWeekNumber, getCurrentSeason, getSeasonWeeks } from './dateHelpers';

/**
 * Group predictions by week number
 * @param {Array} predictions - Array of prediction objects
 * @param {string} season - Season to filter by
 * @returns {Object} Object with week numbers as keys and prediction arrays as values
 */
export const groupPredictionsByWeek = (predictions, season = getCurrentSeason()) => {
  const weekGroups = {};
  
  if (!predictions || !Array.isArray(predictions)) {
    return weekGroups;
  }
  
  predictions.forEach(prediction => {
    // Use fixture date or prediction date
    const predictionDate = prediction.fixture?.date || prediction.created_at || prediction.date;
    
    if (!predictionDate) return;
    
    const weekNumber = getWeekNumber(predictionDate, season);
    
    if (weekNumber > 0) {
      if (!weekGroups[weekNumber]) {
        weekGroups[weekNumber] = [];
      }
      weekGroups[weekNumber].push(prediction);
    }
  });
  
  return weekGroups;
};

/**
 * Calculate total points for predictions in a specific week
 * @param {Array} weekPredictions - Array of predictions for a specific week
 * @returns {number} Total points earned in that week
 */
export const calculateWeeklyPoints = (weekPredictions) => {
  if (!weekPredictions || !Array.isArray(weekPredictions)) {
    return 0;
  }
  
  return weekPredictions.reduce((total, prediction) => {
    // Handle different possible point field names
    const points = prediction.points || prediction.score || 0;
    return total + (typeof points === 'number' ? points : 0);
  }, 0);
};

/**
 * Calculate weekly statistics for predictions
 * @param {Array} weekPredictions - Array of predictions for a specific week
 * @returns {Object} Weekly statistics object
 */
export const calculateWeeklyStats = (weekPredictions) => {
  if (!weekPredictions || !Array.isArray(weekPredictions)) {
    return {
      totalPredictions: 0,
      totalPoints: 0,
      perfectPredictions: 0,
      correctResults: 0,
      incorrectPredictions: 0,
      averagePoints: 0
    };
  }
  
  const totalPredictions = weekPredictions.length;
  const totalPoints = calculateWeeklyPoints(weekPredictions);
  const perfectPredictions = weekPredictions.filter(p => (p.points || 0) === 3).length;
  const correctResults = weekPredictions.filter(p => (p.points || 0) === 1).length;
  const incorrectPredictions = weekPredictions.filter(p => (p.points || 0) === 0).length;
  const averagePoints = totalPredictions > 0 ? totalPoints / totalPredictions : 0;
  
  return {
    totalPredictions,
    totalPoints,
    perfectPredictions,
    correctResults,
    incorrectPredictions,
    averagePoints
  };
};

/**
 * Main function to compute weekly performance data
 * @param {Array} predictions - Array of all user predictions
 * @param {string} season - Season to analyze (optional)
 * @returns {Array} Array of weekly performance objects
 */
export const computeWeeklyPerformance = (predictions, season = getCurrentSeason()) => {
  if (!predictions || !Array.isArray(predictions)) {
    return [];
  }
  
  // Group predictions by week
  const weekGroups = groupPredictionsByWeek(predictions, season);
  
  // Get all possible weeks for the season
  const allWeeks = getSeasonWeeks(season);
  
  // Calculate stats for each week
  const weeklyPerformance = allWeeks.map(weekNumber => {
    const weekPredictions = weekGroups[weekNumber] || [];
    const weekStats = calculateWeeklyStats(weekPredictions);
    
    return {
      week: weekNumber,
      points: weekStats.totalPoints,
      predictions: weekStats.totalPredictions,
      perfectScores: weekStats.perfectPredictions,
      correctResults: weekStats.correctResults,
      incorrectPredictions: weekStats.incorrectPredictions,
      averagePoints: weekStats.averagePoints,
      hasData: weekStats.totalPredictions > 0
    };
  });
  
  // Filter out weeks with no data for cleaner display
  return weeklyPerformance.filter(week => week.hasData);
};

/**
 * Get recent weeks performance (last N weeks with data)
 * @param {Array} predictions - Array of all user predictions
 * @param {number} weeksCount - Number of recent weeks to return
 * @param {string} season - Season to analyze
 * @returns {Array} Array of recent weekly performance objects
 */
export const getRecentWeeksPerformance = (predictions, weeksCount = 5, season = getCurrentSeason()) => {
  const allWeeklyPerformance = computeWeeklyPerformance(predictions, season);
  
  // Sort by week number descending and take the most recent weeks with data
  return allWeeklyPerformance
    .sort((a, b) => b.week - a.week)
    .slice(0, weeksCount)
    .reverse(); // Reverse to show chronologically
};

/**
 * Calculate season totals from weekly performance data
 * @param {Array} weeklyPerformance - Array of weekly performance objects
 * @returns {Object} Season totals object
 */
export const calculateSeasonTotals = (weeklyPerformance) => {
  if (!weeklyPerformance || !Array.isArray(weeklyPerformance)) {
    return {
      totalPoints: 0,
      totalPredictions: 0,
      totalPerfectScores: 0,
      totalCorrectResults: 0,
      totalIncorrectPredictions: 0,
      overallAverage: 0,
      weeksWithData: 0
    };
  }
  
  const totals = weeklyPerformance.reduce((acc, week) => {
    return {
      totalPoints: acc.totalPoints + week.points,
      totalPredictions: acc.totalPredictions + week.predictions,
      totalPerfectScores: acc.totalPerfectScores + week.perfectScores,
      totalCorrectResults: acc.totalCorrectResults + week.correctResults,
      totalIncorrectPredictions: acc.totalIncorrectPredictions + week.incorrectPredictions,
      weeksWithData: acc.weeksWithData + 1
    };
  }, {
    totalPoints: 0,
    totalPredictions: 0,
    totalPerfectScores: 0,
    totalCorrectResults: 0,
    totalIncorrectPredictions: 0,
    weeksWithData: 0
  });
  
  const overallAverage = totals.totalPredictions > 0 
    ? totals.totalPoints / totals.totalPredictions 
    : 0;
  
  return {
    ...totals,
    overallAverage
  };
}; 