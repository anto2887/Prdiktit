// src/components/dashboard/RecentPredictions.jsx
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usePredictions } from '../../contexts/AppContext';
import LoadingSpinner from '../common/LoadingSpinner';

const RecentPredictions = () => {
  const { userPredictions, fetchUserPredictions, loading } = usePredictions();

  useEffect(() => {
    if (!userPredictions || userPredictions.length === 0) {
      fetchUserPredictions();
    }
  }, [userPredictions, fetchUserPredictions]);

  // Get the 5 most recent predictions
  const recentPredictions = userPredictions
    .slice()
    .sort((a, b) => new Date(b.created) - new Date(a.created))
    .slice(0, 5);

  // Helper function to get status badge styling
  const getStatusBadge = (status, points) => {
    if (status === 'PROCESSED') {
      if (points === 3) return 'bg-green-100 text-green-800';
      if (points === 1) return 'bg-yellow-100 text-yellow-800';
      if (points === 0) return 'bg-red-100 text-red-800';
    }
    
    const badges = {
      'EDITABLE': 'bg-gray-100 text-gray-800',
      'SUBMITTED': 'bg-blue-100 text-blue-800',
      'LOCKED': 'bg-yellow-100 text-yellow-800',
      'PROCESSED': 'bg-green-100 text-green-800'
    };
    
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  // Helper function to get points display
  const getPointsDisplay = (prediction) => {
    if (prediction.prediction_status === 'PROCESSED' && prediction.points !== null) {
      const pointsText = `${prediction.points} pts`;
      if (prediction.points === 3) return <span className="text-green-600 font-bold">{pointsText}</span>;
      if (prediction.points === 1) return <span className="text-yellow-600 font-bold">{pointsText}</span>;
      if (prediction.points === 0) return <span className="text-red-600 font-bold">{pointsText}</span>;
    }
    return <span className="text-gray-400">-</span>;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (recentPredictions.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-2">⚽</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No predictions yet</h3>
        <p className="text-gray-600 text-sm mb-4">
          Make your first prediction to get started!
        </p>
        <Link
          to="/predictions/new"
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          Make Prediction
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with view all link */}
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium text-gray-700">Latest Predictions</h3>
        <Link
          to="/predictions/history"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          View all →
        </Link>
      </div>

      {/* Predictions List */}
      <div className="space-y-3">
        {recentPredictions.map((prediction) => (
          <div key={prediction.id} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
            {/* Match Info */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2 text-sm">
                <div className="flex items-center space-x-1">
                  {prediction.fixture?.home_team_logo && (
                    <img 
                      src={prediction.fixture.home_team_logo} 
                      alt={prediction.fixture.home_team}
                      className="w-4 h-4 object-contain"
                    />
                  )}
                  <span className="font-medium">
                    {prediction.fixture?.home_team || 'Home'}
                  </span>
                </div>
                <span className="text-gray-400">vs</span>
                <div className="flex items-center space-x-1">
                  <span className="font-medium">
                    {prediction.fixture?.away_team || 'Away'}
                  </span>
                  {prediction.fixture?.away_team_logo && (
                    <img 
                      src={prediction.fixture.away_team_logo} 
                      alt={prediction.fixture.away_team}
                      className="w-4 h-4 object-contain"
                    />
                  )}
                </div>
              </div>
              <span className="text-xs text-gray-500">
                {prediction.fixture?.league || 'Unknown League'}
              </span>
            </div>

            {/* Prediction vs Result */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {/* Your Prediction */}
                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-1">Your Prediction</div>
                  <span className="inline-flex items-center px-2 py-1 rounded text-sm font-medium bg-blue-100 text-blue-800">
                    {prediction.score1} - {prediction.score2}
                  </span>
                </div>

                {/* Actual Result */}
                {prediction.fixture?.home_score !== null && prediction.fixture?.away_score !== null && (
                  <>
                    <div className="text-gray-400">→</div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500 mb-1">Actual Result</div>
                      <span className="inline-flex items-center px-2 py-1 rounded text-sm font-medium bg-gray-100 text-gray-800">
                        {prediction.fixture.home_score} - {prediction.fixture.away_score}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Points and Status */}
              <div className="text-right">
                <div className="text-xs text-gray-500 mb-1">Points</div>
                <div className="flex items-center space-x-2">
                  {getPointsDisplay(prediction)}
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(prediction.prediction_status, prediction.points)}`}>
                    {prediction.prediction_status === 'PROCESSED' ? 'Done' : prediction.prediction_status}
                  </span>
                </div>
              </div>
            </div>

            {/* Match Date */}
            <div className="mt-2 text-xs text-gray-500">
              {prediction.fixture?.date ? 
                `Match: ${new Date(prediction.fixture.date).toLocaleDateString()}` : 
                'Match date TBD'
              }
            </div>
          </div>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="bg-blue-50 rounded-lg p-3 mt-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-lg font-bold text-blue-600">
              {recentPredictions.filter(p => p.prediction_status === 'PROCESSED').reduce((sum, p) => sum + (p.points || 0), 0)}
            </div>
            <div className="text-xs text-gray-600">Recent Points</div>
          </div>
          <div>
            <div className="text-lg font-bold text-green-600">
              {recentPredictions.filter(p => p.points === 3).length}
            </div>
            <div className="text-xs text-gray-600">Perfect Scores</div>
          </div>
          <div>
            <div className="text-lg font-bold text-purple-600">
              {recentPredictions.filter(p => p.prediction_status === 'PROCESSED').length > 0 
                ? (recentPredictions.filter(p => p.prediction_status === 'PROCESSED').reduce((sum, p) => sum + (p.points || 0), 0) / 
                   recentPredictions.filter(p => p.prediction_status === 'PROCESSED').length).toFixed(1)
                : '0.0'
              }
            </div>
            <div className="text-xs text-gray-600">Avg Points</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecentPredictions;