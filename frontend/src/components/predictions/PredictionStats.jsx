import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../contexts/AppContext';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';

export const PredictionStats = () => {
  const { profile, stats, loading, error } = useUser();
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    if (stats) {
      // Calculate data for charts
      prepareChartData();
    }
  }, [stats]);

  const prepareChartData = () => {
    // This would calculate stats for visualizations
    // For now we'll just prepare some sample data
    setChartData({
      pointsDistribution: [
        { label: 'Perfect Score (3 pts)', value: stats?.perfect_predictions || 0 },
        { label: 'Correct Result (1 pt)', value: stats?.correct_results || 0 },
        { label: 'Incorrect (0 pts)', value: stats?.incorrect_predictions || 0 }
      ],
      weeklyPerformance: [
        { week: 1, points: 5 },
        { week: 2, points: 8 },
        { week: 3, points: 4 },
        { week: 4, points: 9 },
        { week: 5, points: 7 }
      ]
    });
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

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
          {chartData?.pointsDistribution.map((item, index) => (
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
      
      {/* Season Performance */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Weekly Performance</h2>
        
        <div className="h-64 flex items-end space-x-2">
          {chartData?.weeklyPerformance.map((week, index) => (
            <div 
              key={index} 
              className="flex flex-col items-center"
              style={{ width: `${100 / chartData.weeklyPerformance.length}%` }}
            >
              <div 
                className="w-full bg-blue-500 rounded-t"
                style={{ 
                  height: `${(week.points / Math.max(...chartData.weeklyPerformance.map(w => w.points))) * 200}px` 
                }}
              ></div>
              <div className="text-xs text-gray-500 mt-2">Week {week.week}</div>
              <div className="text-sm font-medium">{week.points} pts</div>
            </div>
          ))}
        </div>
      </div>
      
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