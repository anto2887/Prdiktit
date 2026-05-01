// frontend/src/components/groups/GroupPredictionsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNotifications } from '../../contexts/AppContext';
import MobilePageHeader from '../mobile/MobilePageHeader';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import OnboardingGuide, { HelpTooltip } from '../onboarding/OnboardingGuide';
import { useI18n } from '../../i18n';

const GroupPredictionsPage = () => {
  const { t } = useI18n();
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
      // Load group details using the proper API client with session authentication
      const { groupsApi } = await import('../../api');
      const groupResponse = await groupsApi.getGroupById(groupId);
      
      setGroup(groupResponse.data);
      setCurrentWeek(groupResponse.data.current_week || 1);
      
      // Set default week if not selected
      if (!selectedWeek) {
        setSelectedWeek(1); // Start with week 1 as default
      }
      
    } catch (err) {
      process.env.NODE_ENV === 'development' && console.error('Error loading group data:', err);
      setError(t('groupPredictions.loadFailedData'));
      // Only show error notification if we're not in initial loading phase
      // This prevents the brief error flash when navigating to group pages
      if (group) {
        showError(t('groupPredictions.loadFailed'));
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
      
      process.env.NODE_ENV === 'development' && console.log('🔍 === GROUP PREDICTIONS DEBUG START ===');
      process.env.NODE_ENV === 'development' && console.log(`🔍 Loading group predictions for group ${groupId}, week ${week}, season ${season}`);
      process.env.NODE_ENV === 'development' && console.log('🔍 Group data:', group);
      process.env.NODE_ENV === 'development' && console.log('🔍 Selected week:', selectedWeek);
      process.env.NODE_ENV === 'development' && console.log('🔍 Current week:', currentWeek);
      
      // Use the proper API client with session authentication
      const { predictionsApi } = await import('../../api');
      const response = await predictionsApi.getGroupPredictions(groupId, week, season);
      
      // NOTE: predictionsApi already normalizes the API response and returns
      // an object of the form { status, message, data }, so response.data is
      // already the array of predictions.
      process.env.NODE_ENV === 'development' && console.log('🔍 Group predictions API normalized response:', response);
      process.env.NODE_ENV === 'development' && console.log('🔍 Response.data (predictions array):', response.data);
      
      const predictionsArray = Array.isArray(response.data) ? response.data : [];
      process.env.NODE_ENV === 'development' && console.log('🔍 Processed predictions array:', predictionsArray);
      process.env.NODE_ENV === 'development' && console.log('🔍 Predictions array length:', predictionsArray.length);
      process.env.NODE_ENV === 'development' && console.log('🔍 Predictions array type:', typeof predictionsArray);
      
      if (predictionsArray.length > 0) {
        process.env.NODE_ENV === 'development' && console.log('🔍 First prediction structure:', predictionsArray[0]);
        process.env.NODE_ENV === 'development' && console.log('🔍 First prediction keys:', Object.keys(predictionsArray[0]));
      } else {
        setWeekMessage(t('groupPredictions.noPredictionsWeek'));
      }
      
      setPredictions(predictionsArray);
      
    } catch (err) {
      process.env.NODE_ENV === 'development' && console.error('🔍 Error loading predictions:', err);
      process.env.NODE_ENV === 'development' && console.error('🔍 Error stack:', err.stack);
      setPredictions([]);
      
      // Set appropriate week message based on error
      if (err.message.includes('member')) {
        setWeekMessage(t('groupPredictions.notMember'));
      } else if (err.message.includes('not found')) {
        setWeekMessage(t('groupManagement.groupNotFound'));
      } else {
        setWeekMessage(t('groupPredictions.noPredictionsWeek'));
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
  if (!group) return <ErrorMessage message={t('groupManagement.groupNotFound')} />;

  process.env.NODE_ENV === 'development' && console.log('🔍 === GROUP PREDICTIONS RENDER DEBUG ===');
  process.env.NODE_ENV === 'development' && console.log('🔍 Current predictions state:', predictions);
  process.env.NODE_ENV === 'development' && console.log('🔍 Predictions length:', predictions.length);
  process.env.NODE_ENV === 'development' && console.log('🔍 Predictions type:', typeof predictions);
  process.env.NODE_ENV === 'development' && console.log('🔍 Selected week:', selectedWeek);
  process.env.NODE_ENV === 'development' && console.log('🔍 Current week:', currentWeek);
  process.env.NODE_ENV === 'development' && console.log('🔍 View mode:', viewMode);
  process.env.NODE_ENV === 'development' && console.log('🔍 === END RENDER DEBUG ===');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile Header */}
      <MobilePageHeader
        title={group.name}
        backPath={`/groups/${groupId}`}
        actions={[
          <HelpTooltip key="help" content={t('groupPredictions.guideHelp')}>
            <button
              onClick={() => setShowGuide(true)}
              className="p-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              aria-label={t('groupPredictions.openPredictionsHelp')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </HelpTooltip>
        ]}
      />

      {/* Controls row */}
      <div
        className="px-4 pt-3 pb-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-14 z-30 md:static md:top-auto"
        data-tour="tour-group-predictions-controls"
      >
        <div className="flex items-center justify-between space-x-3 overflow-x-auto">
          {/* Week selector */}
          <div className="flex-1 max-w-32 min-w-[8rem]">
            <HelpTooltip content={t('groupPredictions.selectWeekHelp')}>
              <select
                id="week-selector"
                value={selectedWeek || currentWeek}
                onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
                className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {getWeekOptions().map(week => (
                  <option key={week} value={week}>
                    {t('rivalries.week')} {week}
                    {week === currentWeek && ` (${t('groupPredictions.current')})`}
                  </option>
                ))}
              </select>
            </HelpTooltip>
          </div>
          
          {/* View toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 shrink-0" id="view-toggle">
            <HelpTooltip content={t('groupPredictions.viewModeHelp')}>
              <div className="flex">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1 min-h-[44px] text-sm font-medium rounded-md transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  {t('groupPredictions.grid')}
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1 min-h-[44px] text-sm font-medium rounded-md transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  {t('groupPredictions.list')}
                </button>
              </div>
            </HelpTooltip>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4" data-tour="tour-group-predictions-main">
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
            title: t('groupPredictions.guideWelcomeTitle'),
            content: t('groupPredictions.guideWelcomeContent'),
            action: t('common.next'),
            highlight: null
          },
          {
            title: t('groupPredictions.guideWeekTitle'),
            content: t('groupPredictions.guideWeekContent'),
            action: t('common.next'),
            highlight: "week-selector"
          },
          {
            title: t('groupPredictions.guideViewTitle'),
            content: t('groupPredictions.guideViewContent'),
            action: t('common.next'),
            highlight: "view-toggle"
          },
          {
            title: t('groupPredictions.guideResultsTitle'),
            content: t('groupPredictions.guideResultsContent'),
            action: t('common.gotIt'),
            highlight: "predictions-display"
          }
        ]}
      />
    </div>
  );
};

// Empty state component
const EmptyPredictionsState = ({ selectedWeek, weekMessage }) => {
  const { t } = useI18n();
  return (
  <div className="text-center py-12">
    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012-2" />
      </svg>
    </div>
    <h3 className="text-lg font-medium text-gray-900 mb-2">{t('groupPredictions.noneAvailable')}</h3>
    <p className="text-gray-500 text-sm px-4">
      {weekMessage || t('groupPredictions.noPredictionsWeek')}
    </p>
  </div>
  );
};

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
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  
  // Show top 3 predictions by default, expand to show all
  const displayPredictions = expanded ? predictions : predictions.slice(0, 3);
  const hasMore = predictions.length > 3;
  
  const isMatchStarted = fixture?.status !== 'NOT_STARTED';
  const actualResult = fixture?.home_score !== null ? `${fixture.home_score}-${fixture.away_score}` : null;
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Match header */}
      <div className="p-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
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
                <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{fixture?.home_team}</span>
              </div>
              
              <span className="text-gray-400 dark:text-gray-500 text-sm">{t('matches.vs')}</span>
              
              <div className="flex items-center space-x-2">
                <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{fixture?.away_team}</span>
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
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {actualResult ? (
                <span className="font-medium text-green-600 dark:text-green-400">{t('groupPredictions.final')}: {actualResult}</span>
              ) : (
                <span>{fixture?.league} • {new Date(fixture?.date).toLocaleDateString()}</span>
              )}
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {predictions.length} {predictions.length !== 1 ? t('profile.predictions') : t('groupPredictions.prediction')}
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
            className="w-full mt-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
          >
            {expanded ? t('groupPredictions.showLess') : `${t('groupPredictions.show')} ${predictions.length - 3} ${t('groupPredictions.more')}`}
          </button>
        )}
      </div>
    </div>
  );
};

// Individual prediction row
const PredictionRow = ({ prediction, actualResult, isMatchStarted }) => {
  const { t } = useI18n();
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
      accuracyClass = 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
      accuracyIcon = '🎯'; // Perfect
      accuracyTooltip = t('groupPredictions.tooltipPerfect');
    } else if (points === 1) {
      accuracyClass = 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20';
      accuracyIcon = '✓'; // Correct result
      accuracyTooltip = t('groupPredictions.tooltipCorrect');
    } else {
      accuracyClass = 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
      accuracyIcon = '✗'; // Wrong
      accuracyTooltip = t('groupPredictions.tooltipIncorrect');
    }
  }
  
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center space-x-3">
        <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
          {prediction.user?.username || t('groupPredictions.unknownUser')}
        </div>
        
        {prediction.bonus_type && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
            {prediction.bonus_type === 'perfect_week' ? '3x' : '2x'} {t('groupPredictions.bonus')}
          </span>
        )}
      </div>
      
      <div className="flex items-center space-x-2">
        <HelpTooltip content={accuracyTooltip || t('groupPredictions.notProcessed')}>
          <span className={`inline-flex items-center px-2 py-1 rounded-md text-sm font-medium ${accuracyClass || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}`}>
            {accuracyIcon && <span className="mr-1">{accuracyIcon}</span>}
            {predictedScore}
          </span>
        </HelpTooltip>
        
        {isPredictionProcessed && (
          <HelpTooltip content={`${points} ${points !== 1 ? t('mobile.points') : t('mobile.point')} ${t('groupPredictions.earnedForPrediction')}`}>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
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
  const { t } = useI18n();
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {predictions.map((prediction, index) => {
          const isPredictionProcessed = prediction.prediction_status === 'PROCESSED' && prediction.points !== null;
          
          return (
            <div key={index} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                    {prediction.user?.username}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {prediction.fixture?.home_team} {t('matches.vs')} {prediction.fixture?.away_team}
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {prediction.home_score}-{prediction.away_score}
                  </div>
                  {isPredictionProcessed && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
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