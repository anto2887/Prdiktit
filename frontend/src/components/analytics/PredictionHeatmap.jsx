// frontend/src/components/analytics/PredictionHeatmap.jsx
import React, { useState, useEffect } from 'react';
import { useNotifications } from '../../contexts/AppContext';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';

const PredictionHeatmap = ({ groupId, week, season }) => {
  const [heatmapData, setHeatmapData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { showError } = useNotifications();

  useEffect(() => {
    if (groupId && week && season) {
      loadHeatmapData();
    }
  }, [groupId, week, season]);

  const loadHeatmapData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/v1/analytics/group/${groupId}/heatmap?week=${week}&season=${season}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load heatmap data');
      }

      const data = await response.json();
      setHeatmapData(data.data);

    } catch (err) {
      console.error('Error loading heatmap:', err);
      setError('Failed to load prediction heatmap');
      showError('Failed to load heatmap data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!heatmapData) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            🔥 Group Prediction Heatmap
          </h3>
          <div className="text-sm text-gray-500">
            Week {week} • {heatmapData.total_predictions || 0} predictions
          </div>
        </div>
        
        {/* Group accuracy summary */}
        {heatmapData.group_accuracy !== undefined && (
          <div className="mt-2">
            <div className="text-sm text-gray-600">
              Group Accuracy: <span className="font-medium text-green-600">
                {heatmapData.group_accuracy.toFixed(1)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Heatmap content */}
      <div className="p-6">
        {!heatmapData.heatmaps || heatmapData.heatmaps.length === 0 ? (
          <EmptyHeatmapState />
        ) : (
          <div className="space-y-6">
            {heatmapData.heatmaps.map((matchData, index) => (
              <MatchHeatmapCard key={index} matchData={matchData} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Empty state when no data available
const EmptyHeatmapState = () => (
  <div className="text-center py-8">
    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    </div>
    <h3 className="text-lg font-medium text-gray-900 mb-2">No Heatmap Data</h3>
    <p className="text-gray-500 text-sm">
      Heatmaps will appear after group members make predictions for completed matches.
    </p>
  </div>
);

// Individual match heatmap card
const MatchHeatmapCard = ({ matchData }) => {
  const { fixture_info, predictions, total_predictions } = matchData;
  const hasResult = fixture_info.actual_score && fixture_info.actual_score !== 'None-None';
  
  // Get most popular predictions (top 5)
  const topPredictions = Object.entries(predictions)
    .map(([score, count]) => ({
      score,
      count,
      percentage: ((count / total_predictions) * 100).toFixed(1)
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const mostPopular = topPredictions[0];
  const wasCorrect = hasResult && mostPopular?.score === fixture_info.actual_score;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Match header */}
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="font-medium text-gray-900">
            {fixture_info.home_team} vs {fixture_info.away_team}
          </div>
          
          <div className="flex items-center space-x-3">
            {hasResult && (
              <div className="text-sm">
                <span className="text-gray-600">Result: </span>
                <span className="font-medium text-gray-900">
                  {fixture_info.actual_score}
                </span>
              </div>
            )}
            
            <div className="text-sm text-gray-500">
              {total_predictions} prediction{total_predictions !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Predictions heatmap */}
      <div className="p-4">
        <div className="space-y-3">
          {topPredictions.map((pred, index) => (
            <PredictionBar
              key={pred.score}
              prediction={pred}
              rank={index + 1}
              isCorrect={hasResult && pred.score === fixture_info.actual_score}
              isMostPopular={index === 0}
              maxCount={topPredictions[0].count}
            />
          ))}
        </div>

        {/* Consensus analysis */}
        {mostPopular && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="text-sm">
              <span className="text-gray-600">Group Consensus: </span>
              <span className="font-medium text-gray-900">
                {mostPopular.score}
              </span>
              <span className="text-gray-600"> ({mostPopular.percentage}%)</span>
              
              {hasResult && (
                <span className={`ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  wasCorrect 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {wasCorrect ? '🎯 Crowd was right!' : '❌ Crowd was wrong'}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Individual prediction bar in heatmap
const PredictionBar = ({ 
  prediction, 
  rank, 
  isCorrect, 
  isMostPopular, 
  maxCount 
}) => {
  const widthPercentage = (prediction.count / maxCount) * 100;
  
  let barColor = 'bg-blue-200';
  let textColor = 'text-blue-900';
  
  if (isCorrect) {
    barColor = 'bg-green-200';
    textColor = 'text-green-900';
  } else if (isMostPopular) {
    barColor = 'bg-blue-300';
    textColor = 'text-blue-900';
  }

  return (
    <div className="relative">
      {/* Background bar */}
      <div className="h-8 bg-gray-100 rounded-lg overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${barColor}`}
          style={{ width: `${widthPercentage}%` }}
        />
      </div>
      
      {/* Content overlay */}
      <div className="absolute inset-0 flex items-center justify-between px-3">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-900">
            #{rank}
          </span>
          <span className="text-sm font-bold text-gray-900">
            {prediction.score}
          </span>
          {isCorrect && (
            <span className="text-xs">🎯</span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">
            {prediction.count}
          </span>
          <span className="text-sm text-gray-600">
            ({prediction.percentage}%)
          </span>
        </div>
      </div>
    </div>
  );
};

export default PredictionHeatmap;

// ===== COMPACT HEATMAP FOR MOBILE =====

export const CompactHeatmap = ({ groupId, week, season, maxMatches = 2 }) => {
  const [heatmapData, setHeatmapData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (groupId && week && season) {
      loadHeatmapData();
    }
  }, [groupId, week, season]);

  const loadHeatmapData = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/v1/analytics/group/${groupId}/heatmap?week=${week}&season=${season}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setHeatmapData(data.data);
      }
    } catch (err) {
      console.error('Error loading compact heatmap:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !heatmapData?.heatmaps) return null;

  const displayMatches = heatmapData.heatmaps.slice(0, maxMatches);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-gray-900">🔥 Group Heatmap</h4>
        <span className="text-xs text-gray-500">
          {heatmapData.group_accuracy?.toFixed(1)}% accuracy
        </span>
      </div>

      <div className="space-y-3">
        {displayMatches.map((match, index) => (
          <CompactMatchHeatmap key={index} matchData={match} />
        ))}
      </div>

      {heatmapData.heatmaps.length > maxMatches && (
        <div className="mt-3 text-center">
          <span className="text-xs text-gray-500">
            +{heatmapData.heatmaps.length - maxMatches} more matches
          </span>
        </div>
      )}
    </div>
  );
};

const CompactMatchHeatmap = ({ matchData }) => {
  const { fixture_info, predictions, total_predictions } = matchData;
  
  const topPrediction = Object.entries(predictions)
    .map(([score, count]) => ({ score, count, percentage: (count / total_predictions) * 100 }))
    .sort((a, b) => b.count - a.count)[0];

  const isCorrect = fixture_info.actual_score && topPrediction?.score === fixture_info.actual_score;

  return (
    <div className="text-sm">
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-gray-900 text-xs truncate">
          {fixture_info.home_team} vs {fixture_info.away_team}
        </span>
        <span className="text-xs text-gray-500">
          {total_predictions} predictions
        </span>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-sm">
            {topPrediction?.score}
          </span>
          <span className="text-xs text-gray-600">
            ({topPrediction?.percentage.toFixed(0)}%)
          </span>
          {isCorrect && <span className="text-xs">🎯</span>}
        </div>
        
        {fixture_info.actual_score && fixture_info.actual_score !== 'None-None' && (
          <span className="text-xs text-gray-600">
            Actual: {fixture_info.actual_score}
          </span>
        )}
      </div>
    </div>
  );
};