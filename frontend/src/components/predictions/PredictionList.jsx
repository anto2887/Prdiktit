import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMatches, usePredictions } from '../../contexts/AppContext';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import MatchAvailabilityCheck from './MatchAvailabilityCheck';
import TimezoneIndicator from '../common/TimezoneIndicator';
import { formatKickoffTime, formatDeadlineTime, isDateInPast } from '../../utils/dateUtils';

const PredictionList = () => {
  const { fixtures, fetchFixtures, loading: matchesLoading, error: matchesError } = useMatches();
  const { userPredictions, fetchUserPredictions, loading: predictionsLoading } = usePredictions();
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setIsInitialLoading(true);
      try {
        // Get upcoming matches
        const today = new Date();
        const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        await Promise.all([
          fetchFixtures({
            from: today.toISOString().split('T')[0],
            to: nextWeek.toISOString().split('T')[0],
            status: 'NOT_STARTED'
          }),
          fetchUserPredictions()
        ]);
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadData();
  }, [fetchFixtures, fetchUserPredictions]);

  if (isInitialLoading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <LoadingSpinner />
      </div>
    );
  }

  const error = matchesError;
  if (error) {
    return <ErrorMessage message={error} />;
  }

  // Filter upcoming matches that haven't started
  const upcomingMatches = fixtures.filter(match => {
    const matchDate = new Date(match.date);
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
          <h2 className="text-2xl font-bold text-gray-900">Upcoming Matches</h2>
          <div className="flex items-center gap-4">
            <TimezoneIndicator showDetails={true} />
            <Link
              to="/predictions/history"
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              View History →
            </Link>
          </div>
        </div>

        {upcomingMatches.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-500 mb-4">No upcoming matches available for prediction</p>
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
                  className="bg-white rounded-lg shadow-md overflow-hidden border-l-4 border-blue-500 hover:shadow-lg transition-shadow"
                >
                  <div className="p-6">
                    {/* Match Info Header with timezone-aware time */}
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-gray-500 text-sm">
                        {formatKickoffTime(match.date)}
                      </span>
                      <span className="text-xs font-medium px-2 py-1 bg-gray-100 rounded-full">
                        {match.league}
                      </span>
                    </div>
                    
                    {/* Teams */}
                    <div className="flex justify-between items-center mb-6">
                      <div className="flex flex-col items-center w-5/12">
                        <img 
                          src={match.home_team_logo || '/placeholder-logo.svg'} 
                          alt={`${match.home_team} logo`}
                          className="w-12 h-12 object-contain mb-2"
                          onError={(e) => { e.target.src = '/placeholder-logo.svg'; }}
                        />
                        <span className="text-center font-medium text-sm text-gray-900">
                          {match.home_team}
                        </span>
                      </div>
                      
                      <div className="w-2/12 text-center">
                        <span className="text-gray-500 font-bold">VS</span>
                      </div>
                      
                      <div className="flex flex-col items-center w-5/12">
                        <img 
                          src={match.away_team_logo || '/placeholder-logo.svg'} 
                          alt={`${match.away_team} logo`}
                          className="w-12 h-12 object-contain mb-2"
                          onError={(e) => { e.target.src = '/placeholder-logo.svg'; }}
                        />
                        <span className="text-center font-medium text-sm text-gray-900">
                          {match.away_team}
                        </span>
                      </div>
                    </div>
                    
                    {/* Current Prediction Display */}
                    {hasPrediction && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                        <div className="flex items-center justify-center space-x-4">
                          <div className="text-center">
                            <p className="text-xs text-gray-600 mb-1">Your Prediction</p>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-lg">{prediction.score1}</span>
                              <span className="text-gray-500">-</span>
                              <span className="font-bold text-lg">{prediction.score2}</span>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-green-600 text-center mt-2">
                          ✓ Prediction submitted
                        </p>
                      </div>
                    )}
                    
                    {/* Action Button */}
                    <div className="space-y-2">
                      {deadlinePassed ? (
                        <div className="w-full py-2 text-center rounded-md bg-gray-100 text-gray-500 text-sm">
                          Prediction Deadline Passed
                        </div>
                      ) : (
                        <Link 
                          to={`/predictions/new?match=${match.fixture_id}`}
                          className={`block w-full py-2 text-center rounded-md text-white font-medium transition-colors
                            ${hasPrediction 
                              ? 'bg-green-600 hover:bg-green-700' 
                              : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                        >
                          {hasPrediction ? 'Edit Prediction' : 'Make Prediction'}
                        </Link>
                      )}
                      
                      {/* Deadline Info with timezone awareness */}
                      <p className="text-xs text-gray-500 text-center">
                        {(() => {
                          const deadline = match.prediction_deadline || match.date;
                          const { text, urgency } = formatDeadlineTime(deadline);
                          
                          return (
                            <span className={`
                              ${urgency === 'critical' ? 'text-red-600 font-semibold' : ''}
                              ${urgency === 'high' ? 'text-orange-600 font-medium' : ''}
                              ${urgency === 'medium' ? 'text-yellow-600' : ''}
                              ${urgency === 'expired' ? 'text-red-500' : ''}
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
    </MatchAvailabilityCheck>
  );
};

export default PredictionList;