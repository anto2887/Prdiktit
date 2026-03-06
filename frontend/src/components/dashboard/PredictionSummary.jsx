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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Your Prediction Summary</h2>
      
      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.totalPoints}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Points</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.perfectScores}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Perfect Scores</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.correctResults}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Correct Results</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{averagePoints}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Avg per Match</div>
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">Processed:</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{stats.processed}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">Locked:</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{stats.locked}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">Submitted:</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{stats.submitted}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">Drafts:</span>
            <span className={`font-medium ${stats.needsAttention > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-900 dark:text-gray-100'}`}>
              {stats.editable}
              {stats.needsAttention > 0 && <span className="ml-1">⚠️</span>}
            </span>
          </div>
        </div>
      </div>

      {/* Attention needed alert */}
      {stats.needsAttention > 0 && (
        <div className="mt-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
          <div className="flex">
            <div className="text-yellow-600 dark:text-yellow-400 mr-2">⚠️</div>
            <div>
              <div className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                {stats.needsAttention} draft prediction(s) on completed matches
              </div>
              <div className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
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