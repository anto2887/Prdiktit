// frontend/src/components/groups/GroupPredictionsPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNotifications } from '../../contexts/AppContext';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';

const GroupPredictionsPage = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotifications();
  
  // State management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [group, setGroup] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  useEffect(() => {
    if (groupId) {
      loadGroupData();
    }
  }, [groupId, selectedWeek]);

  const loadGroupData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Load group details
      const groupResponse = await fetch(`/api/v1/groups/${groupId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
      });
      
      if (!groupResponse.ok) {
        throw new Error('Failed to load group');
      }
      
      const groupData = await groupResponse.json();
      setGroup(groupData.data);
      setCurrentWeek(groupData.data.current_week || 1);
      
      // Set default week if not selected
      if (!selectedWeek) {
        setSelectedWeek(groupData.data.current_week || 1);
      }
      
      // Load group predictions for the selected week
      await loadGroupPredictions();
      
    } catch (err) {
      console.error('Error loading group data:', err);
      setError('Failed to load group data');
      showError('Failed to load group predictions');
    } finally {
      setLoading(false);
    }
  };

  const loadGroupPredictions = async () => {
    try {
      const week = selectedWeek || currentWeek;
      const response = await fetch(`/api/v1/predictions/group/${groupId}/week/${week}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to load predictions');
      }
      
      const data = await response.json();
      setPredictions(data.data || []);
      
    } catch (err) {
      console.error('Error loading predictions:', err);
      setPredictions([]);
    }
  };

  const getWeekOptions = () => {
    const weeks = [];
    for (let i = 1; i <= Math.max(currentWeek + 2, 10); i++) {
      weeks.push(i);
    }
    return weeks;
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!group) return <ErrorMessage message="Group not found" />;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3">
          {/* Top row: Back button and group name */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => navigate(`/groups/${groupId}`)}
              className="flex items-center text-blue-600 hover:text-blue-800"
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm font-medium">Back to Group</span>
            </button>
            
            <h1 className="text-lg font-bold text-gray-900 truncate ml-2">
              {group.name}
            </h1>
          </div>
          
          {/* Controls row */}
          <div className="flex items-center justify-between space-x-3">
            {/* Week selector */}
            <div className="flex-1 max-w-32">
              <select
                value={selectedWeek || currentWeek}
                onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
                className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {getWeekOptions().map(week => (
                  <option key={week} value={week}>
                    Week {week}
                    {week === currentWeek && ' (Current)'}
                  </option>
                ))}
              </select>
            </div>
            
            {/* View toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                List
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {predictions.length === 0 ? (
          <EmptyPredictionsState selectedWeek={selectedWeek} />
        ) : (
          <PredictionsDisplay 
            predictions={predictions} 
            viewMode={viewMode}
            selectedWeek={selectedWeek}
          />
        )}
      </div>
    </div>
  );
};

// Empty state component
const EmptyPredictionsState = ({ selectedWeek }) => (
  <div className="text-center py-12">
    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012-2" />
      </svg>
    </div>
    <h3 className="text-lg font-medium text-gray-900 mb-2">No Predictions Yet</h3>
    <p className="text-gray-500 text-sm px-4">
      {selectedWeek && selectedWeek > new Date().getWeek() 
        ? `Week ${selectedWeek} predictions will be visible after kickoff times.`
        : 'No group members have made predictions for this week yet.'
      }
    </p>
  </div>
);

// Predictions display component
const PredictionsDisplay = ({ predictions, viewMode, selectedWeek }) => {
  if (viewMode === 'list') {
    return <PredictionsListView predictions={predictions} selectedWeek={selectedWeek} />;
  }
  
  return <PredictionsGridView predictions={predictions} selectedWeek={selectedWeek} />;
};

// Grid view for mobile-first design
const PredictionsGridView = ({ predictions, selectedWeek }) => {
  // Group predictions by match
  const predictionsByMatch = predictions.reduce((acc, pred) => {
    const matchKey = `${pred.fixture?.home_team} vs ${pred.fixture?.away_team}`;
    if (!acc[matchKey]) {
      acc[matchKey] = {
        fixture: pred.fixture,
        predictions: []
      };
    }
    acc[matchKey].predictions.push(pred);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(predictionsByMatch).map(([matchKey, matchData]) => (
        <MatchPredictionCard 
          key={matchKey}
          fixture={matchData.fixture}
          predictions={matchData.predictions}
          selectedWeek={selectedWeek}
        />
      ))}
    </div>
  );
};

// Individual match prediction card
const MatchPredictionCard = ({ fixture, predictions, selectedWeek }) => {
  const [expanded, setExpanded] = useState(false);
  
  // Show top 3 predictions by default, expand to show all
  const displayPredictions = expanded ? predictions : predictions.slice(0, 3);
  const hasMore = predictions.length > 3;
  
  const isMatchStarted = fixture?.status !== 'NOT_STARTED';
  const actualResult = fixture?.home_score !== null ? `${fixture.home_score}-${fixture.away_score}` : null;
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Match header */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3">
              {/* Team logos and names */}
              <div className="flex items-center space-x-2">
                {fixture?.home_team_logo && (
                  <img 
                    src={fixture.home_team_logo} 
                    alt={fixture.home_team}
                    className="w-6 h-6 object-contain"
                  />
                )}
                <span className="font-medium text-sm">{fixture?.home_team}</span>
              </div>
              
              <span className="text-gray-400 text-sm">vs</span>
              
              <div className="flex items-center space-x-2">
                <span className="font-medium text-sm">{fixture?.away_team}</span>
                {fixture?.away_team_logo && (
                  <img 
                    src={fixture.away_team_logo} 
                    alt={fixture.away_team}
                    className="w-6 h-6 object-contain"
                  />
                )}
              </div>
            </div>
            
            {/* Match status/result */}
            <div className="mt-1 text-xs text-gray-500">
              {actualResult ? (
                <span className="font-medium text-green-600">Final: {actualResult}</span>
              ) : (
                <span>{fixture?.league} • {new Date(fixture?.date).toLocaleDateString()}</span>
              )}
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-sm font-medium text-gray-900">
              {predictions.length} prediction{predictions.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>
      
      {/* Predictions */}
      <div className="p-4">
        <div className="space-y-3">
          {displayPredictions.map((prediction, index) => (
            <PredictionRow 
              key={`${prediction.user?.username}-${index}`}
              prediction={prediction}
              actualResult={actualResult}
              isMatchStarted={isMatchStarted}
            />
          ))}
        </div>
        
        {/* Expand/collapse button */}
        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full mt-3 py-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            {expanded ? 'Show Less' : `Show ${predictions.length - 3} More`}
          </button>
        )}
      </div>
    </div>
  );
};

// Individual prediction row
const PredictionRow = ({ prediction, actualResult, isMatchStarted }) => {
  const predictedScore = `${prediction.home_score}-${prediction.away_score}`;
  const points = prediction.points || 0;
  
  // Determine accuracy
  let accuracyClass = '';
  let accuracyIcon = null;
  
  if (isMatchStarted && actualResult) {
    if (points === 3) {
      accuracyClass = 'text-green-600 bg-green-50';
      accuracyIcon = '🎯'; // Perfect
    } else if (points === 1) {
      accuracyClass = 'text-yellow-600 bg-yellow-50';
      accuracyIcon = '✓'; // Correct result
    } else {
      accuracyClass = 'text-red-600 bg-red-50';
      accuracyIcon = '✗'; // Wrong
    }
  }
  
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center space-x-3">
        <div className="font-medium text-sm text-gray-900">
          {prediction.user?.username || 'Unknown User'}
        </div>
        
        {prediction.bonus_type && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            {prediction.bonus_type === 'perfect_week' ? '3x' : '2x'} Bonus
          </span>
        )}
      </div>
      
      <div className="flex items-center space-x-2">
        <span className={`inline-flex items-center px-2 py-1 rounded-md text-sm font-medium ${accuracyClass || 'bg-gray-100 text-gray-800'}`}>
          {accuracyIcon && <span className="mr-1">{accuracyIcon}</span>}
          {predictedScore}
        </span>
        
        {isMatchStarted && (
          <span className="text-sm font-medium text-gray-600">
            {points}pt{points !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
};

// List view (compact alternative)
const PredictionsListView = ({ predictions }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="divide-y divide-gray-200">
        {predictions.map((prediction, index) => (
          <div key={index} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="font-medium text-sm text-gray-900">
                  {prediction.user?.username}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {prediction.fixture?.home_team} vs {prediction.fixture?.away_team}
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-sm font-medium">
                  {prediction.home_score}-{prediction.away_score}
                </div>
                {prediction.points !== undefined && (
                  <div className="text-xs text-gray-500">
                    {prediction.points} pts
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Helper function to get current week number
Date.prototype.getWeek = function() {
  const oneJan = new Date(this.getFullYear(), 0, 1);
  const numberOfDays = Math.floor((this - oneJan) / (24 * 60 * 60 * 1000));
  return Math.ceil((this.getDay() + 1 + numberOfDays) / 7);
};

export default GroupPredictionsPage;