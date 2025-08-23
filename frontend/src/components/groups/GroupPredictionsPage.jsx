// frontend/src/components/groups/GroupPredictionsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNotifications } from '../../contexts/AppContext';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import OnboardingGuide, { HelpTooltip } from '../onboarding/OnboardingGuide';

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
  const [weekMessage, setWeekMessage] = useState(null);
  
  // Guide state
  const [showGuide, setShowGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);

  useEffect(() => {
    if (groupId) {
      loadGroupData();
    }
  }, [groupId]); // Remove loadGroupData from dependencies

  // Effect to load predictions when group data is available or week changes
  useEffect(() => {
    if (group && selectedWeek) {
      loadGroupPredictions();
    }
  }, [selectedWeek, group]); // Remove loadGroupPredictions from dependencies

  const loadGroupData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Load group details using the same API base URL as other components
      const API_BASE_URL = process.env.REACT_APP_API_URL || '/api/v1';
      const groupResponse = await fetch(`${API_BASE_URL}/groups/${groupId}`, {
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
        setSelectedWeek(1); // Start with week 1 as default
      }
      
    } catch (err) {
      process.env.NODE_ENV === 'development' && console.error('Error loading group data:', err);
      setError('Failed to load predictions data');
      // Only show error notification if we're not in initial loading phase
      // This prevents the brief error flash when navigating to group pages
      if (group) {
        showError('Failed to load group predictions');
      }
    } finally {
      setLoading(false);
    }
  }, [groupId, showError, group]); // Add group to dependencies

  const loadGroupPredictions = useCallback(async () => {
    try {
      setWeekMessage(null); // Clear any previous message
      const week = selectedWeek || currentWeek;
      // Use the correct season format for MLS (2025 instead of 2024-2025)
      const season = '2025'; // MLS uses calendar year format
      const API_BASE_URL = process.env.REACT_APP_API_URL || '/api/v1';
      
      process.env.NODE_ENV === 'development' && console.log('🔍 === GROUP PREDICTIONS DEBUG START ===');
      process.env.NODE_ENV === 'development' && console.log(`🔍 Loading group predictions for group ${groupId}, week ${week}, season ${season}`);
      process.env.NODE_ENV === 'development' && console.log('🔍 Group data:', group);
      process.env.NODE_ENV === 'development' && console.log('🔍 Selected week:', selectedWeek);
      process.env.NODE_ENV === 'development' && console.log('🔍 Current week:', currentWeek);
      
      const response = await fetch(`${API_BASE_URL}/predictions/group/${groupId}/week/${week}?season=${season}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
      });
      
      process.env.NODE_ENV === 'development' && console.log(`🔍 Group predictions response status: ${response.status}`);
      process.env.NODE_ENV === 'development' && console.log(`🔍 Response headers:`, Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        process.env.NODE_ENV === 'development' && console.error(`🔍 Group predictions API error: ${response.status} - ${errorText}`);
        
        // Handle specific error cases
        if (response.status === 403) {
          throw new Error('You are not a member of this group');
        } else if (response.status === 404) {
          throw new Error('Group not found');
        } else {
          throw new Error(`Failed to load predictions: ${response.status}`);
        }
      }
      
      const data = await response.json();
      process.env.NODE_ENV === 'development' && console.log('🔍 Group predictions API response:', data);
      process.env.NODE_ENV === 'development' && console.log('🔍 Response data type:', typeof data);
      process.env.NODE_ENV === 'development' && console.log('🔍 Response data keys:', Object.keys(data));
      process.env.NODE_ENV === 'development' && console.log('🔍 Response.data type:', typeof data.data);
      process.env.NODE_ENV === 'development' && console.log('🔍 Response.data:', data.data);
      
      const predictionsArray = Array.isArray(data.data) ? data.data : [];
      process.env.NODE_ENV === 'development' && console.log('🔍 Processed predictions array:', predictionsArray);
      process.env.NODE_ENV === 'development' && console.log('🔍 Predictions array length:', predictionsArray.length);
      process.env.NODE_ENV === 'development' && console.log('🔍 Predictions array type:', typeof predictionsArray);
      
      if (predictionsArray.length > 0) {
        process.env.NODE_ENV === 'development' && console.log('🔍 First prediction structure:', predictionsArray[0]);
        process.env.NODE_ENV === 'development' && console.log('🔍 First prediction keys:', Object.keys(predictionsArray[0]));
      } else {
        setWeekMessage("No predictions available this week to display");
      }
      
      setPredictions(predictionsArray);
      
    } catch (err) {
      process.env.NODE_ENV === 'development' && console.error('🔍 Error loading predictions:', err);
      process.env.NODE_ENV === 'development' && console.error('🔍 Error stack:', err.stack);
      setPredictions([]);
      
      // Set appropriate week message based on error
      if (err.message.includes('member')) {
        setWeekMessage("You are not a member of this group");
      } else if (err.message.includes('not found')) {
        setWeekMessage("Group not found");
      } else {
        setWeekMessage("No predictions available this week to display");
      }
    }
  }, [groupId, selectedWeek, currentWeek, group]); // Keep only necessary dependencies

  const getWeekOptions = () => {
    // Get league-specific week ranges
    const leagueWeekRanges = {
      'Premier League': 38,
      'La Liga': 38,
      'Serie A': 38,
      'Bundesliga': 34,
      'Ligue 1': 38,
      'MLS': 34,
      'Champions League': 13,
      'Europa League': 15,
      'World Cup': 7,
      'FA Cup': 8,
      'League Cup': 7,
      'Championship': 46
    };
    
    // Get the max weeks for the current group's league, default to 38
    const maxWeeks = leagueWeekRanges[group?.league] || 38;
    
    const weeks = [];
    for (let i = 1; i <= maxWeeks; i++) {
      weeks.push(i);
    }
    return weeks;
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!group) return <ErrorMessage message="Group not found" />;

  process.env.NODE_ENV === 'development' && console.log('🔍 === GROUP PREDICTIONS RENDER DEBUG ===');
  process.env.NODE_ENV === 'development' && console.log('🔍 Current predictions state:', predictions);
  process.env.NODE_ENV === 'development' && console.log('🔍 Predictions length:', predictions.length);
  process.env.NODE_ENV === 'development' && console.log('🔍 Predictions type:', typeof predictions);
  process.env.NODE_ENV === 'development' && console.log('🔍 Selected week:', selectedWeek);
  process.env.NODE_ENV === 'development' && console.log('🔍 Current week:', currentWeek);
  process.env.NODE_ENV === 'development' && console.log('🔍 View mode:', viewMode);
  process.env.NODE_ENV === 'development' && console.log('🔍 === END RENDER DEBUG ===');

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
              <HelpTooltip content="Select a specific week to view predictions for that week">
                <select
                  id="week-selector"
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
              </HelpTooltip>
            </div>
            
            {/* View toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1" id="view-toggle">
              <HelpTooltip content="Switch between grid view (cards) and list view (compact)">
                <div className="flex">
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
              </HelpTooltip>
            </div>
            
            {/* Help button */}
            <HelpTooltip content="Start the guided tour to learn about this page">
              <button
                onClick={() => setShowGuide(true)}
                className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </HelpTooltip>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4">
        {predictions.length === 0 ? (
          <EmptyPredictionsState selectedWeek={selectedWeek} weekMessage={weekMessage} />
        ) : (
          <div id="predictions-display">
            <PredictionsDisplay 
              predictions={predictions} 
              viewMode={viewMode} 
              selectedWeek={selectedWeek} 
            />
          </div>
        )}
      </div>
      
      {/* Guide/Help System */}
      <OnboardingGuide
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
        onComplete={() => setShowGuide(false)}
        step={guideStep}
        totalSteps={4}
        steps={[
          {
            title: "Welcome to Group Predictions!",
            content: "This page shows all predictions made by your group members for the selected week. You can see how everyone predicted each match and compare results.",
            action: "Next",
            highlight: null
          },
          {
            title: "Week Selection",
            content: "Use the week selector to view predictions for different weeks. The current week is marked with '(Current)'. Different leagues have different numbers of weeks.",
            action: "Next",
            highlight: "week-selector"
          },
          {
            title: "View Modes",
            content: "Switch between Grid view (shows match cards) and List view (compact format). Grid view is great for seeing match details, while List view is perfect for quick scanning.",
            action: "Next",
            highlight: "view-toggle"
          },
          {
            title: "Understanding Results",
            content: "Each prediction shows the user's predicted score and points earned. Perfect predictions (exact score) earn 3 points, correct results earn 1 point. Points are only shown for processed predictions.",
            action: "Got it!",
            highlight: "predictions-display"
          }
        ]}
      />
    </div>
  );
};

// Empty state component
const EmptyPredictionsState = ({ selectedWeek, weekMessage }) => (
  <div className="text-center py-12">
    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012-2" />
      </svg>
    </div>
    <h3 className="text-lg font-medium text-gray-900 mb-2">No Predictions Available</h3>
    <p className="text-gray-500 text-sm px-4">
      {weekMessage || "No predictions available this week to display"}
    </p>
  </div>
);

// Predictions display component
const PredictionsDisplay = ({ predictions, viewMode, selectedWeek }) => {
  process.env.NODE_ENV === 'development' && console.log('🔍 === PREDICTIONS DISPLAY DEBUG ===');
  process.env.NODE_ENV === 'development' && console.log('🔍 PredictionsDisplay received predictions:', predictions);
  process.env.NODE_ENV === 'development' && console.log('🔍 PredictionsDisplay predictions length:', predictions.length);
  process.env.NODE_ENV === 'development' && console.log('🔍 PredictionsDisplay viewMode:', viewMode);
  process.env.NODE_ENV === 'development' && console.log('🔍 PredictionsDisplay selectedWeek:', selectedWeek);
  process.env.NODE_ENV === 'development' && console.log('🔍 === END PREDICTIONS DISPLAY DEBUG ===');

  if (viewMode === 'list') {
    return <PredictionsListView predictions={predictions} />;
  }
  
  return <PredictionsGridView predictions={predictions} selectedWeek={selectedWeek} />;
};

// Grid view for mobile-first design
const PredictionsGridView = ({ predictions, selectedWeek }) => {
  process.env.NODE_ENV === 'development' && console.log('🔍 === PREDICTIONS GRID VIEW DEBUG ===');
  process.env.NODE_ENV === 'development' && console.log('🔍 PredictionsGridView received predictions:', predictions);
  process.env.NODE_ENV === 'development' && console.log('🔍 PredictionsGridView predictions length:', predictions.length);
  
  // Group predictions by match
  const predictionsByMatch = predictions.reduce((acc, pred) => {
    process.env.NODE_ENV === 'development' && console.log('🔍 Processing prediction:', pred);
    process.env.NODE_ENV === 'development' && console.log('🔍 Prediction fixture:', pred.fixture);
    process.env.NODE_ENV === 'development' && console.log('🔍 Prediction user:', pred.user);
    
    const matchKey = pred.fixture?.fixture_id || pred.match_id;
    process.env.NODE_ENV === 'development' && console.log('🔍 Match key:', matchKey);
    
    if (!acc[matchKey]) {
      acc[matchKey] = {
        fixture: pred.fixture,
        predictions: []
      };
    }
    acc[matchKey].predictions.push(pred);
    return acc;
  }, {});

  process.env.NODE_ENV === 'development' && console.log('🔍 PredictionsByMatch result:', predictionsByMatch);
  process.env.NODE_ENV === 'development' && console.log('🔍 Number of matches:', Object.keys(predictionsByMatch).length);
  process.env.NODE_ENV === 'development' && console.log('🔍 === END PREDICTIONS GRID VIEW DEBUG ===');

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
  
  // Show points if prediction has been processed (has points assigned)
  const isPredictionProcessed = prediction.prediction_status === 'PROCESSED' && prediction.points !== null;
  
  // Determine accuracy
  let accuracyClass = '';
  let accuracyIcon = null;
  let accuracyTooltip = '';
  
  if (isPredictionProcessed) {
    if (points === 3) {
      accuracyClass = 'text-green-600 bg-green-50';
      accuracyIcon = '🎯'; // Perfect
      accuracyTooltip = 'Perfect prediction! Exact score match (3 points)';
    } else if (points === 1) {
      accuracyClass = 'text-yellow-600 bg-yellow-50';
      accuracyIcon = '✓'; // Correct result
      accuracyTooltip = 'Correct result! Right winner/draw (1 point)';
    } else {
      accuracyClass = 'text-red-600 bg-red-50';
      accuracyIcon = '✗'; // Wrong
      accuracyTooltip = 'Incorrect prediction (0 points)';
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
        <HelpTooltip content={accuracyTooltip || 'Prediction not yet processed'}>
          <span className={`inline-flex items-center px-2 py-1 rounded-md text-sm font-medium ${accuracyClass || 'bg-gray-100 text-gray-800'}`}>
            {accuracyIcon && <span className="mr-1">{accuracyIcon}</span>}
            {predictedScore}
          </span>
        </HelpTooltip>
        
        {isPredictionProcessed && (
          <HelpTooltip content={`${points} point${points !== 1 ? 's' : ''} earned for this prediction`}>
            <span className="text-sm font-medium text-gray-600">
              {points}pt{points !== 1 ? 's' : ''}
            </span>
          </HelpTooltip>
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
        {predictions.map((prediction, index) => {
          const isPredictionProcessed = prediction.prediction_status === 'PROCESSED' && prediction.points !== null;
          
          return (
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
                  {isPredictionProcessed && (
                    <div className="text-xs text-gray-500">
                      {prediction.points} pts
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
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