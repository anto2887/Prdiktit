// src/components/dashboard/RecentPredictions.jsx
import React, { useMemo } from 'react';
import { usePredictions } from '../../contexts/AppContext';
import { formatDate } from '../../utils/dateUtils';

const RecentPredictions = () => {
  const { userPredictions, predictionsLoading } = usePredictions();

  // Debug logging
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('RecentPredictions: Component rendered');
      console.log('RecentPredictions: userPredictions:', userPredictions);
      console.log('RecentPredictions: predictionsLoading:', predictionsLoading);
      console.log('RecentPredictions: userPredictions type:', typeof userPredictions);
      console.log('RecentPredictions: userPredictions isArray:', Array.isArray(userPredictions));
      if (userPredictions && userPredictions.length > 0) {
        console.log('RecentPredictions: First prediction sample:', userPredictions[0]);
      }
    }
  }, [userPredictions, predictionsLoading]);

  const recentPredictions = useMemo(() => {
    if (!userPredictions || !Array.isArray(userPredictions)) return [];
    
    return userPredictions
      .filter(pred => pred.fixture && pred.fixture.status !== 'NOT_STARTED')
      .sort((a, b) => new Date(b.created) - new Date(a.created))
      .slice(0, 5);
  }, [userPredictions]);

  if (predictionsLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Your Recent Predictions
        </h3>
        <div className="animate-pulse">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="bg-gray-200 h-4 w-4 rounded"></div>
                <div className="bg-gray-200 h-4 flex-1 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!recentPredictions || recentPredictions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Your Recent Predictions
        </h3>
        {predictionsLoading ? (
          <p className="text-gray-500 text-sm">Loading predictions...</p>
        ) : (
          <div>
            <p className="text-gray-500 text-sm">
              No predictions made yet. Start predicting match outcomes to see them here!
            </p>
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
                <p>Debug: userPredictions = {JSON.stringify(userPredictions)}</p>
                <p>Debug: predictionsLoading = {predictionsLoading}</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Your Recent Predictions
      </h3>
      <div className="space-y-3">
        {recentPredictions.map((prediction) => (
          <div key={prediction.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-900">
                  {prediction.fixture?.home_team} vs {prediction.fixture?.away_team}
                </span>
                {prediction.fixture?.status === 'FINISHED' && prediction.points !== null && (
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    prediction.points === 3 ? 'bg-green-100 text-green-800' : 
                    prediction.points === 1 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {prediction.points === 3 ? 'Perfect' : 
                     prediction.points === 1 ? 'Partial' : 'Incorrect'}
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-500">
                {prediction.score1} - {prediction.score2} • {formatDate(prediction.created)}
              </div>
            </div>
            {prediction.fixture?.status === 'FINISHED' && (
              <div className="text-sm font-medium text-gray-900">
                {prediction.fixture.home_score} - {prediction.fixture.away_score}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentPredictions;