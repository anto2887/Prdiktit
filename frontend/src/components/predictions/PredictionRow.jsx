import React from 'react';
import PredictionStatusBadge from '../common/PredictionStatusBadge';
import { getPointsBadgeColor } from '../../utils/predictionHelpers';

const PredictionRow = ({ prediction }) => {
  const matchDate = prediction.fixture?.date ? new Date(prediction.fixture.date) : null;
  const isCompletedMatch = prediction.fixture?.home_score !== null && prediction.fixture?.away_score !== null;
  
  // Check if prediction needs attention (EDITABLE status with past match date)
  const needsAttention = prediction.prediction_status === 'EDITABLE' && 
                        matchDate && 
                        matchDate < new Date();

  return (
    <tr className={`hover:bg-gray-50 ${needsAttention ? 'bg-yellow-50 border-l-4 border-yellow-400' : ''}`}>
      {/* Match Info */}
      <td className="px-6 py-4">
        <div className="flex flex-col">
          <div className="font-medium text-gray-900">
            {prediction.fixture?.home_team} vs {prediction.fixture?.away_team}
          </div>
          <div className="text-sm text-gray-500">
            {prediction.fixture?.league}
          </div>
          {needsAttention && (
            <div className="text-xs text-yellow-600 mt-1 font-medium">
              ⚠️ Draft prediction on completed match
            </div>
          )}
        </div>
      </td>

      {/* Your Prediction */}
      <td className="px-6 py-4 text-center">
        <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-blue-50 text-blue-700">
          {prediction.score1} - {prediction.score2}
        </span>
      </td>

      {/* Actual Result */}
      <td className="px-6 py-4 text-center">
        {isCompletedMatch ? (
          <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-gray-100 text-gray-800">
            {prediction.fixture.home_score} - {prediction.fixture.away_score}
          </span>
        ) : (
          <span className="text-gray-400 text-sm">-</span>
        )}
      </td>

      {/* Points */}
      <td className="px-6 py-4 text-center">
        {prediction.prediction_status === 'PROCESSED' && prediction.points !== null ? (
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-sm font-bold ${getPointsBadgeColor(prediction.points)}`}>
            {prediction.points} pts
          </span>
        ) : (
          <span className="text-gray-400 text-sm">-</span>
        )}
      </td>

      {/* Status */}
      <td className="px-6 py-4 text-center">
        <PredictionStatusBadge 
          status={prediction.prediction_status} 
          points={prediction.points}
        />
      </td>

      {/* Date */}
      <td className="px-6 py-4 text-center text-sm text-gray-500">
        {matchDate ? (
          <div>
            <div>{matchDate.toLocaleDateString()}</div>
            <div className="text-xs">{matchDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
          </div>
        ) : (
          'TBD'
        )}
      </td>
    </tr>
  );
};

export default PredictionRow; 