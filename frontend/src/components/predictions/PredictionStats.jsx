import React from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../contexts/AppContext';
import { useWeeklyStats } from '../../hooks/useWeeklyStats';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';

export const PredictionStats = () => {
  const { profile, stats, loading: userLoading, error: userError } = useUser();
  const { 
    recentWeeksPerformance, 
    seasonTotals, 
    statistics, 
    loading: weeklyLoading, 
    error: weeklyError,
    hasData 
  } = useWeeklyStats({ recentWeeksCount: 5 });

  // Combined loading and error states
  const isLoading = userLoading || weeklyLoading;
  const error = userError || weeklyError;

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  // Prepare chart data from real weekly performance
  const chartData = {
    pointsDistribution: [
      { label: 'Perfect Score (3 pts)', value: stats?.perfect_predictions || 0 },
      { label: 'Correct Result (1 pt)', value: stats?.correct_results || 0 },
      { label: 'Incorrect (0 pts)', value: stats?.incorrect_predictions || 0 }
    ],
    weeklyPerformance: recentWeeksPerformance
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Prediction Statistics</h1>
        <Link
          to="/predictions/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          New Prediction
        </Link>
      </div>
      
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
          <h3 className="text-sm font-medium text-gray-500">Total Points</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">{stats?.total_points || 0}</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
          <h3 className="text-sm font-medium text-gray-500">Perfect Predictions</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">{stats?.perfect_predictions || 0}</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-yellow-500">
          <h3 className="text-sm font-medium text-gray-500">Correct Results</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">{stats?.correct_results || 0}</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-purple-500">
          <h3 className="text-sm font-medium text-gray-500">Average Points</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {(stats?.average_points || 0).toFixed(1)}
          </p>
        </div>
      </div>
      
      {/* Detailed Stats */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Prediction Accuracy</h2>
        
        <div className="space-y-4">
          {chartData.pointsDistribution.map((item, index) => (
            <div key={index} className="relative pt-1">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-xs font-semibold inline-block text-gray-600">
                    {item.label}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold inline-block text-gray-600">
                    {item.value} predictions
                  </span>
                </div>
              </div>
              <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-200">
                <div 
                  style={{ width: `${(item.value / Math.max(...chartData.pointsDistribution.map(d => d.value))) * 100}%` }}
                  className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center 
                    ${index === 0 ? 'bg-green-500' : index === 1 ? 'bg-yellow-500' : 'bg-red-500'}`}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Weekly Performance */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Weekly Performance</h2>
        
        {hasData && chartData.weeklyPerformance.length > 0 ? (
          <div className="h-64 flex items-end space-x-2">
            {chartData.weeklyPerformance.map((week, index) => (
              <div 
                key={index} 
                className="flex flex-col items-center"
                style={{ width: `${100 / chartData.weeklyPerformance.length}%` }}
              >
                <div 
                  className="w-full bg-blue-500 rounded-t"
                  style={{ 
                    height: `${Math.max(20, (week.points / Math.max(...chartData.weeklyPerformance.map(w => w.points))) * 200)}px` 
                  }}
                ></div>
                <div className="text-xs text-gray-500 mt-2">Week {week.week}</div>
                <div className="text-sm font-medium">{week.points} pts</div>
                <div className="text-xs text-gray-400">{week.predictions} predictions</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-4xl mb-2">📊</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No weekly data yet</h3>
            <p className="text-gray-600 text-sm">
              Make some predictions to see your weekly performance here!
            </p>
          </div>
        )}
      </div>
      
      {/* Season Summary */}
      {hasData && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Season Summary</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{statistics.totalWeeksWithData}</div>
              <div className="text-sm text-gray-500">Active Weeks</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {statistics.averagePointsPerWeek.toFixed(1)}
              </div>
              <div className="text-sm text-gray-500">Avg Points/Week</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {statistics.bestWeek ? statistics.bestWeek.points : 0}
              </div>
              <div className="text-sm text-gray-500">
                Best Week {statistics.bestWeek ? `(Week ${statistics.bestWeek.week})` : ''}
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{statistics.consistencyScore}%</div>
              <div className="text-sm text-gray-500">Consistency</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Team Performance */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Team Performance</h2>
        
        <p className="text-gray-500 text-center py-12">
          Team performance analytics will be available after you make more predictions
        </p>
      </div>
    </div>
  );
};

export default PredictionStats;