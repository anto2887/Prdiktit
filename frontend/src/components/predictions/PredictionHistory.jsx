// src/components/predictions/PredictionHistory.jsx
import React, { useState, useEffect } from 'react';
import { usePredictions, useUser } from '../../contexts/AppContext';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';

const PredictionHistory = () => {
  const { userPredictions, fetchUserPredictions, loading, error } = usePredictions();
  const { profile } = useUser();
  const [filters, setFilters] = useState({
    season: '',
    week: '',
    status: ''
  });

  useEffect(() => {
    fetchUserPredictions();
  }, [fetchUserPredictions]);

  // Filter predictions
  const filteredPredictions = userPredictions.filter(prediction => {
    if (filters.season && prediction.season !== filters.season) return false;
    if (filters.week && prediction.week !== parseInt(filters.week)) return false;
    if (filters.status && prediction.prediction_status !== filters.status) return false;
    return true;
  });

  // Group predictions by status for stats
  const predictionStats = filteredPredictions.reduce((stats, pred) => {
    const status = pred.prediction_status;
    const points = pred.points || 0;
    
    if (!stats[status]) {
      stats[status] = { count: 0, totalPoints: 0 };
    }
    
    stats[status].count++;
    stats[status].totalPoints += points;
    
    return stats;
  }, {});

  const totalPoints = Object.values(predictionStats).reduce((sum, stat) => sum + stat.totalPoints, 0);
  const totalPredictions = filteredPredictions.length;

  // Helper function to get status badge
  const getStatusBadge = (status) => {
    const badges = {
      'EDITABLE': 'bg-gray-100 text-gray-800',
      'SUBMITTED': 'bg-blue-100 text-blue-800',
      'LOCKED': 'bg-yellow-100 text-yellow-800',
      'PROCESSED': 'bg-green-100 text-green-800'
    };
    
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  // Helper function to get points badge
  const getPointsBadge = (points) => {
    if (points === 3) return 'bg-green-100 text-green-800 font-bold';
    if (points === 1) return 'bg-yellow-100 text-yellow-800 font-bold';
    if (points === 0) return 'bg-red-100 text-red-800 font-bold';
    return 'bg-gray-100 text-gray-800';
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Prediction History</h1>
        <p className="text-gray-600">View all your predictions and their results</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">Total Points</div>
          <div className="text-2xl font-bold text-blue-600">{totalPoints}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">Total Predictions</div>
          <div className="text-2xl font-bold text-gray-900">{totalPredictions}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">Perfect Scores</div>
          <div className="text-2xl font-bold text-green-600">
            {filteredPredictions.filter(p => p.points === 3).length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">Average Points</div>
          <div className="text-2xl font-bold text-purple-600">
            {totalPredictions > 0 ? (totalPoints / totalPredictions).toFixed(1) : '0.0'}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Season</label>
              <select
                value={filters.season}
                onChange={(e) => setFilters({...filters, season: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">All Seasons</option>
                <option value="2024-2025">2024-2025</option>
                <option value="2023-2024">2023-2024</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Week</label>
              <select
                value={filters.week}
                onChange={(e) => setFilters({...filters, week: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">All Weeks</option>
                {Array.from({ length: 38 }, (_, i) => i + 1).map(week => (
                  <option key={week} value={week}>Week {week}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">All Statuses</option>
                <option value="EDITABLE">Editable</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="LOCKED">Locked</option>
                <option value="PROCESSED">Processed</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Predictions Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Match
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Your Prediction
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actual Result
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Points
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPredictions.length > 0 ? (
                filteredPredictions.map((prediction) => (
                  <tr key={prediction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          {prediction.fixture?.home_team_logo && (
                            <img 
                              src={prediction.fixture.home_team_logo} 
                              alt={prediction.fixture.home_team}
                              className="w-6 h-6 object-contain"
                            />
                          )}
                          <span className="text-sm font-medium">
                            {prediction.fixture?.home_team || 'Home Team'}
                          </span>
                        </div>
                        <span className="text-gray-500">vs</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">
                            {prediction.fixture?.away_team || 'Away Team'}
                          </span>
                          {prediction.fixture?.away_team_logo && (
                            <img 
                              src={prediction.fixture.away_team_logo} 
                              alt={prediction.fixture.away_team}
                              className="w-6 h-6 object-contain"
                            />
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {prediction.fixture?.league || 'Unknown League'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                        {prediction.score1} - {prediction.score2}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {prediction.fixture?.home_score !== null && prediction.fixture?.away_score !== null ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                          {prediction.fixture.home_score} - {prediction.fixture.away_score}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">Not played</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {prediction.points !== null ? (
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${getPointsBadge(prediction.points)}`}>
                          {prediction.points} pts
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(prediction.prediction_status)}`}>
                        {prediction.prediction_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-500">
                      {prediction.fixture?.date ? 
                        new Date(prediction.fixture.date).toLocaleDateString() : 
                        'TBD'
                      }
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                    No predictions found with the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PredictionHistory;