import React from 'react';

const PredictionSummary = ({ predictions = [] }) => {
  // Calculate stats
  const stats = predictions.reduce((acc, pred) => {
    const status = pred.prediction_status;
    const points = pred.points || 0;
    
    acc.total++;
    
    if (status === 'PROCESSED') {
      acc.processed++;
      acc.totalPoints += points;
      if (points === 3) acc.perfectScores++;
      if (points === 1) acc.correctResults++;
      if (points === 0) acc.incorrect++;
    } else if (status === 'LOCKED') {
      acc.locked++;
    } else if (status === 'SUBMITTED') {
      acc.submitted++;
    } else if (status === 'EDITABLE') {
      acc.editable++;
      // Check if this is a past match that needs attention
      const matchDate = pred.fixture?.date ? new Date(pred.fixture.date) : null;
      if (matchDate && matchDate < new Date()) {
        acc.needsAttention++;
      }
    }
    
    return acc;
  }, {
    total: 0,
    processed: 0,
    locked: 0,
    submitted: 0,
    editable: 0,
    needsAttention: 0,
    totalPoints: 0,
    perfectScores: 0,
    correctResults: 0,
    incorrect: 0
  });

  const averagePoints = stats.processed > 0 ? (stats.totalPoints / stats.processed).toFixed(1) : 0;

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Prediction Summary</h2>
      
      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.totalPoints}</div>
          <div className="text-sm text-gray-500">Total Points</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{stats.perfectScores}</div>
          <div className="text-sm text-gray-500">Perfect Scores</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-600">{stats.correctResults}</div>
          <div className="text-sm text-gray-500">Correct Results</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">{averagePoints}</div>
          <div className="text-sm text-gray-500">Avg per Match</div>
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="border-t pt-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Processed:</span>
            <span className="font-medium">{stats.processed}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Locked:</span>
            <span className="font-medium">{stats.locked}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Submitted:</span>
            <span className="font-medium">{stats.submitted}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Drafts:</span>
            <span className={`font-medium ${stats.needsAttention > 0 ? 'text-yellow-600' : ''}`}>
              {stats.editable}
              {stats.needsAttention > 0 && <span className="ml-1">⚠️</span>}
            </span>
          </div>
        </div>
      </div>

      {/* Attention needed alert */}
      {stats.needsAttention > 0 && (
        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <div className="flex">
            <div className="text-yellow-600 mr-2">⚠️</div>
            <div>
              <div className="text-sm font-medium text-yellow-800">
                {stats.needsAttention} draft prediction(s) on completed matches
              </div>
              <div className="text-xs text-yellow-700 mt-1">
                These predictions were in draft status when matches ended. Points cannot be awarded for incomplete predictions.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PredictionSummary; 