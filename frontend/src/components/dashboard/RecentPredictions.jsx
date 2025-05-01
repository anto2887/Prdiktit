import React from 'react';
import { Link } from 'react-router-dom';
import { usePredictions } from '../../contexts/PredictionContext';
import { formatDate } from '../../utils/dateUtils';
import { formatMatchResult, formatPredictionStatus } from '../../utils/formatters';

const RecentPredictions = () => {
  const { userPredictions } = usePredictions();

  // Add safety check to prevent sorting undefined
  const recentPredictions = userPredictions && userPredictions.length > 0
    ? [...userPredictions]
        .sort((a, b) => {
          const dateA = a.fixture?.date ? new Date(a.fixture.date) : new Date(0);
          const dateB = b.fixture?.date ? new Date(b.fixture.date) : new Date(0);
          return dateB - dateA;
        })
        .slice(0, 5)
    : [];

  if (!userPredictions || userPredictions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>You haven't made any predictions yet.</p>
        <Link 
          to="/predictions/new" 
          className="mt-4 inline-block text-blue-600 hover:text-blue-800"
        >
          Make your first prediction →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {recentPredictions.map((prediction) => {
        const fixture = prediction.fixture || {};
        const isPredictionCorrect = prediction.status === 'PROCESSED' && prediction.points === 3;
        const isResultCorrect = prediction.status === 'PROCESSED' && prediction.points === 1;
        
        return (
          <Link 
            key={prediction.id || Math.random().toString()} 
            to={prediction.id ? `/predictions/edit/${prediction.id}` : '/predictions'}
            className={`block p-4 rounded-lg border ${
              isPredictionCorrect 
                ? 'border-green-200 bg-green-50' 
                : isResultCorrect 
                  ? 'border-yellow-200 bg-yellow-50' 
                  : 'border-gray-200 hover:bg-gray-50'
            } transition-colors`}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <img src={fixture.home_team_logo || '/placeholder-logo.svg'} 
                       alt="" 
                       className="h-8 w-8 object-contain"
                       onError={(e) => { e.target.src = '/placeholder-logo.svg'; }} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {fixture.home_team || 'Home Team'} vs {fixture.away_team || 'Away Team'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {fixture.date ? formatDate(fixture.date, 'PPP') : 'Date not available'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">
                  {prediction.score1 !== undefined ? prediction.score1 : '-'}-
                  {prediction.score2 !== undefined ? prediction.score2 : '-'}
                </p>
                <p className="text-xs text-gray-500">
                  {fixture.status === 'FINISHED' 
                    ? `Result: ${formatMatchResult(fixture.home_score, fixture.away_score)}` 
                    : fixture.status || 'Pending'}
                </p>
              </div>
            </div>
            {prediction.status === 'PROCESSED' && (
              <div className="mt-2 flex justify-end">
                <span 
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    prediction.points === 3 
                      ? 'bg-green-100 text-green-800' 
                      : prediction.points === 1 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {prediction.points} {prediction.points === 1 ? 'point' : 'points'}
                </span>
              </div>
            )}
          </Link>
        );
      })}
      
      <div className="text-center pt-2">
        <Link 
          to="/predictions/history" 
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          View all predictions →
        </Link>
      </div>
    </div>
  );
};

export default RecentPredictions;