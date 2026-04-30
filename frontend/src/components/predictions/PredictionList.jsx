import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMatches, usePredictions } from '../../contexts/AppContext';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import MatchAvailabilityCheck from './MatchAvailabilityCheck';
import TimezoneIndicator from '../common/TimezoneIndicator';
import { formatKickoffTime, formatDeadlineTime, isDateInPast } from '../../utils/dateUtils';
import OnboardingGuide, { HelpTooltip } from '../onboarding/OnboardingGuide';
import { useI18n } from '../../i18n';

const PredictionList = () => {
  const { t } = useI18n();
  const { fixtures, loading: matchesLoading, error: matchesError } = useMatches();
  const { userPredictions, loading: predictionsLoading } = usePredictions();
  
  // Guide state
  const [showGuide, setShowGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  
  // REMOVED: Broken useEffect that was causing dependency issues
  // Data fetching is now handled by parent PredictionsPage

  // Show loading if context is still loading (for real-time updates)
  if (matchesLoading || predictionsLoading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <LoadingSpinner />
        <span className="ml-3 text-gray-500 dark:text-gray-400">{t('predictions.updatingMatchData')}</span>
      </div>
    );
  }

  const error = matchesError;
  if (error) {
    return <ErrorMessage message={error} />;
  }

  // Filter upcoming matches that haven't started
  const upcomingMatches = fixtures.filter(match => {
    const matchDate = new Date(match.date + 'Z'); // Force UTC interpretation
    const now = new Date();
    return matchDate > now && match.status === 'NOT_STARTED';
  });

  const getPredictionForMatch = (fixtureId) => {
    return userPredictions?.find(p => p.fixture_id === fixtureId);
  };

  const isPredictionDeadlinePassed = (match) => {
    if (match.prediction_deadline) {
      return isDateInPast(match.prediction_deadline);
    }
    
    // Fallback: if no deadline from API, use match kickoff time
    return isDateInPast(match.date);
  };

  return (
    <MatchAvailabilityCheck>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('predictions.upcomingMatches')}</h2>
          <div className="flex items-center gap-4">
            <HelpTooltip content={t('predictions.tooltipTimezone')}>
              <TimezoneIndicator showDetails={true} />
            </HelpTooltip>
            <Link
              to="/predictions/history"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium"
            >
              {t('predictions.viewHistory')} →
            </Link>
            <HelpTooltip content={t('predictions.tooltipGuide')}>
              <button
                onClick={() => setShowGuide(true)}
                className="p-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </HelpTooltip>
          </div>
        </div>

        {/* Date Range Display */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <div className="flex items-center justify-center">
            <span className="text-sm text-blue-800 dark:text-blue-200">
              📅 {t('predictions.showingMatchesFrom')} <strong>{(() => {
                const today = new Date();
                const nextWeek = new Date(today);
                nextWeek.setDate(today.getDate() + 7);
                return `${today.toLocaleDateString()} to ${nextWeek.toLocaleDateString()}`;
              })()}</strong>
            </span>
          </div>
        </div>

        {upcomingMatches.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400 mb-4">{t('predictions.noUpcomingMatches')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingMatches.map(match => {
              const prediction = getPredictionForMatch(match.fixture_id);
              const hasPrediction = !!prediction;
              const deadlinePassed = isPredictionDeadlinePassed(match);
              
              return (
                <div 
                  key={match.fixture_id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border-l-4 border-blue-500 dark:border-blue-400 hover:shadow-lg transition-shadow"
                >
                  <div className="p-6">
                    {/* Match Info Header with timezone-aware time */}
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-gray-500 dark:text-gray-400 text-sm">
                        {formatKickoffTime(match.date)}
                      </span>
                      <span className="text-xs font-medium px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full">
                        {match.league}
                      </span>
                    </div>
                    
                    {/* Teams */}
                    <div className="flex justify-between items-center mb-6">
                      <div className="flex flex-col items-center w-5/12">
                        {match.home_team_logo ? (
                          <img 
                            src={match.home_team_logo} 
                            alt={`${match.home_team} logo`}
                            className="w-12 h-12 object-contain mb-2"
                            onError={(e) => { 
                              e.target.style.display = 'none';
                              e.target.nextElementSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center mb-2" style={{ display: match.home_team_logo ? 'none' : 'flex' }}>
                          <span className="text-gray-500 dark:text-gray-400 text-lg">⚽</span>
                        </div>
                        <span className="text-center font-medium text-sm text-gray-900 dark:text-gray-100">
                          {match.home_team}
                        </span>
                      </div>
                      
                      <div className="w-2/12 text-center">
                        <span className="text-gray-500 dark:text-gray-400 font-bold">VS</span>
                      </div>
                      
                      <div className="flex flex-col items-center w-5/12">
                        {match.away_team_logo ? (
                          <img 
                            src={match.away_team_logo} 
                            alt={`${match.away_team} logo`}
                            className="w-12 h-12 object-contain mb-2"
                            onError={(e) => { 
                              e.target.style.display = 'none';
                              e.target.nextElementSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center mb-2" style={{ display: match.away_team_logo ? 'none' : 'flex' }}>
                          <span className="text-gray-500 dark:text-gray-400 text-lg">⚽</span>
                        </div>
                        <span className="text-center font-medium text-sm text-gray-900 dark:text-gray-100">
                          {match.away_team}
                        </span>
                      </div>
                    </div>
                    
                    {/* Current Prediction Display */}
                    {hasPrediction && (
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-4">
                        <div className="flex items-center justify-center space-x-4">
                          <div className="text-center">
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{t('predictions.yourPrediction')}</p>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-lg text-gray-900 dark:text-gray-100">{prediction.score1}</span>
                              <span className="text-gray-500 dark:text-gray-400">-</span>
                              <span className="font-bold text-lg text-gray-900 dark:text-gray-100">{prediction.score2}</span>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-green-600 dark:text-green-400 text-center mt-2">
                          ✓ {t('predictions.submitted')}
                        </p>
                      </div>
                    )}
                    
                    {/* Action Button */}
                    <div className="space-y-2">
                      {deadlinePassed ? (
                        <div className="w-full py-2 text-center rounded-md bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-sm">
                          {t('predictions.deadlinePassed')}
                        </div>
                      ) : (
                        <Link 
                          to={`/predictions/new?match=${match.fixture_id}`}
                          className={`block w-full py-2 text-center rounded-md text-white font-medium transition-colors
                            ${hasPrediction 
                              ? 'bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600' 
                              : 'bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600'
                            }`}
                        >
                          {hasPrediction ? t('predictions.editPrediction') : t('predictions.makePrediction')}
                        </Link>
                      )}
                      
                      {/* Deadline Info with timezone awareness */}
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                        {(() => {
                          const deadline = match.prediction_deadline || match.date;
                          const { text, urgency } = formatDeadlineTime(deadline);
                          
                          return (
                            <span className={`
                              ${urgency === 'critical' ? 'text-red-600 dark:text-red-400 font-semibold' : ''}
                              ${urgency === 'high' ? 'text-orange-600 dark:text-orange-400 font-medium' : ''}
                              ${urgency === 'medium' ? 'text-yellow-600 dark:text-yellow-400' : ''}
                              ${urgency === 'expired' ? 'text-red-500 dark:text-red-400' : ''}
                            `}>
                              {urgency === 'expired' ? '🚫' : '⏰'} {text}
                            </span>
                          );
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
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
            title: t('predictions.guideTitle1'),
            content: t('predictions.guideContent1'),
            action: t('common.next'),
            highlight: null
          },
          {
            title: t('predictions.guideTitle2'),
            content: t('predictions.guideContent2'),
            action: t('common.next'),
            highlight: null
          },
          {
            title: t('predictions.guideTitle3'),
            content: t('predictions.guideContent3'),
            action: t('common.next'),
            highlight: null
          },
          {
            title: t('predictions.guideTitle4'),
            content: t('predictions.guideContent4'),
            action: t('common.gotIt'),
            highlight: null
          }
        ]}
      />
    </MatchAvailabilityCheck>
  );
};

export default PredictionList;