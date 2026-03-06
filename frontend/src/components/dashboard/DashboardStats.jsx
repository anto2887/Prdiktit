// src/components/dashboard/DashboardStats.jsx
import React, { useEffect, useState } from 'react';
import { useUser, usePredictions } from '../../contexts/AppContext';

const DashboardStats = ({ stats }) => {
  const { profile } = useUser();
  const { userPredictions, fetchUserPredictions } = usePredictions();
  const [calculatedStats, setCalculatedStats] = useState({
    totalPoints: 0,
    totalPredictions: 0,
    perfectScores: 0,
    correctResults: 0,
    averagePoints: 0,
    accuracy: 0
  });

  // Calculate stats from user predictions - Fixed: Only fetch once on mount
  useEffect(() => {
    fetchUserPredictions();
  }, [fetchUserPredictions]);

  // Calculate stats from userPredictions data
  useEffect(() => {
    if (userPredictions && userPredictions.length > 0) {
      const stats = userPredictions.reduce((acc, pred) => {
        // Count total predictions
        acc.totalPredictions++;
        
        // Only count processed predictions for points and accuracy
        if (pred.prediction_status === 'PROCESSED' && pred.points !== null) {
          acc.totalPoints += pred.points || 0;
          
          if (pred.points === 3) {
            acc.perfectScores++;
          } else if (pred.points === 1) {
            acc.correctResults++;
          }
        }
        
        return acc;
      }, {
        totalPoints: 0,
        totalPredictions: 0,
        perfectScores: 0,
        correctResults: 0,
        averagePoints: 0,
        accuracy: 0
      });
      
      // Calculate derived stats
      const processedPredictions = userPredictions.filter(p => 
        p.prediction_status === 'PROCESSED' && p.points !== null
      ).length;
      
      stats.averagePoints = processedPredictions > 0 ? stats.totalPoints / processedPredictions : 0;
      stats.accuracy = processedPredictions > 0 ? 
        ((stats.perfectScores + stats.correctResults) / processedPredictions) * 100 : 0;
      
      setCalculatedStats(stats);
    }
  }, [userPredictions]);

  // Use calculated stats if available, otherwise fall back to props
  const displayStats = {
    totalPoints: calculatedStats.totalPoints || stats?.total_points || 0,
    totalPredictions: calculatedStats.totalPredictions || stats?.total_predictions || 0,
    perfectScores: calculatedStats.perfectScores || stats?.perfect_scores || 0,
    correctResults: calculatedStats.correctResults || stats?.correct_results || 0,
    averagePoints: calculatedStats.averagePoints || stats?.average_points || 0,
    accuracy: calculatedStats.accuracy || stats?.accuracy_percentage || 0
  };

  const StatCard = ({ title, value, subtitle, color = "blue", icon }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className={`text-2xl font-bold text-${color}-600 dark:text-${color}-400`}>
            {typeof value === 'number' && value % 1 !== 0 ? value.toFixed(1) : value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className={`p-2 bg-${color}-100 dark:bg-${color}-900 rounded-full`}>
            <span className="text-lg">{icon}</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Points"
          value={displayStats.totalPoints}
          subtitle="All time"
          color="blue"
          icon="🎯"
        />
        <StatCard
          title="Predictions Made"
          value={displayStats.totalPredictions}
          subtitle="Total submitted"
          color="green"
          icon="⚽"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Perfect Scores"
          value={displayStats.perfectScores}
          subtitle="3 points each"
          color="yellow"
          icon="🏆"
        />
        <StatCard
          title="Correct Results"
          value={displayStats.correctResults}
          subtitle="1 point each"
          color="purple"
          icon="✅"
        />
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Average Points"
          value={displayStats.averagePoints}
          subtitle="Per prediction"
          color="indigo"
          icon="📊"
        />
        <StatCard
          title="Accuracy"
          value={`${displayStats.accuracy.toFixed(1)}%`}
          subtitle="Correct predictions"
          color="emerald"
          icon="🎯"
        />
      </div>

      {/* Quick Insights */}
      {displayStats.totalPredictions > 0 && (
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mt-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quick Insights</h3>
          <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex justify-between">
              <span>Incorrect predictions:</span>
              <span>{displayStats.totalPredictions - displayStats.perfectScores - displayStats.correctResults}</span>
            </div>
            <div className="flex justify-between">
              <span>Points per correct prediction:</span>
              <span>
                {displayStats.perfectScores + displayStats.correctResults > 0 
                  ? (displayStats.totalPoints / (displayStats.perfectScores + displayStats.correctResults)).toFixed(1)
                  : '0.0'
                }
              </span>
            </div>
            {displayStats.totalPredictions >= 10 && (
              <div className="mt-2 text-xs">
                {displayStats.accuracy >= 70 ? (
                  <span className="text-green-600 dark:text-green-400">🔥 Excellent accuracy! Keep it up!</span>
                ) : displayStats.accuracy >= 50 ? (
                  <span className="text-yellow-600 dark:text-yellow-400">👍 Good job! Room for improvement.</span>
                ) : (
                  <span className="text-blue-600 dark:text-blue-400">📈 Keep predicting to improve your accuracy!</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* No data state */}
      {displayStats.totalPredictions === 0 && (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-4xl mb-2">⚽</div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No predictions yet</h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Start making predictions to see your stats here!
          </p>
        </div>
      )}
    </div>
  );
};

export default DashboardStats;