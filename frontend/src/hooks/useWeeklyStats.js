// src/hooks/useWeeklyStats.js
import { useMemo } from 'react';
import { usePredictions } from '../contexts/AppContext';
import { 
  computeWeeklyPerformance, 
  getRecentWeeksPerformance,
  calculateSeasonTotals 
} from '../utils/weeklyStatsCalculator';
import { getCurrentSeason } from '../utils/dateHelpers';

/**
 * Custom hook for computing weekly performance statistics
 * @param {Object} options - Configuration options
 * @param {string} options.season - Season to analyze (defaults to current season)
 * @param {number} options.recentWeeksCount - Number of recent weeks to include (default: 5)
 * @returns {Object} Weekly statistics object
 */
export const useWeeklyStats = (options = {}) => {
  const { 
    season = getCurrentSeason(), 
    recentWeeksCount = 5 
  } = options;
  
  // Get predictions data from context (no fetching here to avoid loops)
  const { userPredictions, loading, error } = usePredictions();
  
  // Compute weekly performance data - memoized to prevent unnecessary recalculations
  const weeklyPerformance = useMemo(() => {
    if (!userPredictions || userPredictions.length === 0) {
      return [];
    }
    
    return computeWeeklyPerformance(userPredictions, season);
  }, [userPredictions, season]);
  
  // Compute recent weeks performance - memoized
  const recentWeeksPerformance = useMemo(() => {
    if (!userPredictions || userPredictions.length === 0) {
      return [];
    }
    
    return getRecentWeeksPerformance(userPredictions, recentWeeksCount, season);
  }, [userPredictions, recentWeeksCount, season]);
  
  // Calculate season totals - memoized
  const seasonTotals = useMemo(() => {
    return calculateSeasonTotals(weeklyPerformance);
  }, [weeklyPerformance]);
  
  // Compute additional statistics - memoized
  const statistics = useMemo(() => {
    if (weeklyPerformance.length === 0) {
      return {
        hasData: false,
        totalWeeksWithData: 0,
        bestWeek: null,
        worstWeek: null,
        averagePointsPerWeek: 0,
        consistencyScore: 0
      };
    }
    
    // Find best and worst performing weeks
    const sortedByPoints = [...weeklyPerformance].sort((a, b) => b.points - a.points);
    const bestWeek = sortedByPoints[0];
    const worstWeek = sortedByPoints[sortedByPoints.length - 1];
    
    // Calculate average points per week (only weeks with data)
    const averagePointsPerWeek = seasonTotals.weeksWithData > 0 
      ? seasonTotals.totalPoints / seasonTotals.weeksWithData 
      : 0;
    
    // Calculate consistency score (lower standard deviation = more consistent)
    const pointsArray = weeklyPerformance.map(week => week.points);
    const mean = averagePointsPerWeek;
    const variance = pointsArray.reduce((acc, points) => acc + Math.pow(points - mean, 2), 0) / pointsArray.length;
    const standardDeviation = Math.sqrt(variance);
    const consistencyScore = Math.max(0, 100 - (standardDeviation * 10)); // Convert to 0-100 scale
    
    return {
      hasData: true,
      totalWeeksWithData: seasonTotals.weeksWithData,
      bestWeek,
      worstWeek,
      averagePointsPerWeek,
      consistencyScore: Math.round(consistencyScore)
    };
  }, [weeklyPerformance, seasonTotals]);
  
  // Return all computed data and metadata
  return {
    // Raw data
    weeklyPerformance,
    recentWeeksPerformance,
    
    // Aggregated statistics
    seasonTotals,
    statistics,
    
    // Metadata
    season,
    loading,
    error,
    hasData: statistics.hasData,
    
    // Helper functions for components
    getWeekData: (weekNumber) => {
      return weeklyPerformance.find(week => week.week === weekNumber) || null;
    },
    
    getPointsForWeek: (weekNumber) => {
      const weekData = weeklyPerformance.find(week => week.week === weekNumber);
      return weekData ? weekData.points : 0;
    }
  };
};

export default useWeeklyStats; 