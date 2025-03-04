import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePredictions } from '../../contexts/PredictionContext';
import { useMatches } from '../../contexts/MatchContext';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import MatchAvailabilityCheck from './MatchAvailabilityCheck';

export const PredictionList = () => {
  const { fetchFixtures, fixtures, loading: fixturesLoading, error: fixturesError } = useMatches();
  const { userPredictions, fetchUserPredictions, loading: predictionsLoading, error: predictionsError } = usePredictions();
  const [upcomingMatches, setUpcomingMatches] = useState([]);

  const loading = fixturesLoading || predictionsLoading;
  const error = fixturesError || predictionsError;

  useEffect(() => {
    const loadData = async () => {
      // Fetch fixtures for next 7 days
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      
      await fetchFixtures({
        from: today.toISOString(),
        to: nextWeek.toISOString(),
        status: 'NOT_STARTED'
      });
      
      await fetchUserPredictions();
    };

    loadData();
  }, [fetchFixtures, fetchUserPredictions]);

  useEffect(() => {
    if (fixtures?.length) {
      // Filter upcoming matches that haven't started yet and sort by date
      const upcoming = fixtures
        .filter(match => match.status === 'NOT_STARTED' && new Date(match.date) > new Date())
        .sort((a, b) => new Date(a.date) - new Date(b.date));
        
      setUpcomingMatches(upcoming);
    }
  }, [fixtures]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <MatchAvailabilityCheck>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Upcoming Matches</h1>
          <Link
            to="/predictions/history"
            className="text-blue-600 hover:text-blue-800"
          >
            View Past Predictions →
          </Link>
        </div>
        
        {upcomingMatches.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-500 mb-4">No upcoming matches available for prediction</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingMatches.map(match => {
              const matchDate = new Date(match.date);
              const hasPrediction = userPredictions.some(p => p.fixture_id === match.fixture_id);
              
              return (
                <div 
                  key={match.fixture_id}
                  className="bg-white rounded-lg shadow-md overflow-hidden border-t-4 border-blue-500"
                >
                  <div className="p-4">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-gray-500 text-sm">
                        {matchDate.toLocaleDateString()} | {matchDate.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      <span className="text-xs font-medium px-2 py-1 bg-gray-100 rounded-full">
                        {match.league}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex flex-col items-center w-5/12">
                        <img 
                          src={match.home_team_logo} 
                          alt={`${match.home_team} logo`}
                          className="w-12 h-12 object-contain mb-2"
                        />
                        <span className="text-center font-medium text-sm">{match.home_team}</span>
                      </div>
                      
                      <div className="w-2/12 text-center text-gray-500">vs</div>
                      
                      <div className="flex flex-col items-center w-5/12">
                        <img 
                          src={match.away_team_logo} 
                          alt={`${match.away_team} logo`}
                          className="w-12 h-12 object-contain mb-2"
                        />
                        <span className="text-center font-medium text-sm">{match.away_team}</span>
                      </div>
                    </div>
                    
                    <Link 
                      to={hasPrediction 
                        ? `/predictions/edit/${userPredictions.find(p => p.fixture_id === match.fixture_id).prediction_id}`
                        : `/predictions/new?match=${match.fixture_id}`
                      }
                      className={`block w-full py-2 text-center rounded-md text-white
                        ${hasPrediction 
                          ? 'bg-green-600 hover:bg-green-700' 
                          : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                    >
                      {hasPrediction ? 'View/Edit Prediction' : 'Make Prediction'}
                    </Link>
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