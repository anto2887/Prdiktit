import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMatches, usePredictions } from '../../contexts/AppContext';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';

const UpcomingMatches = () => {
  const { fixtures, fetchFixtures, loading, error } = useMatches();
  const { userPredictions } = usePredictions();
  const [upcomingMatches, setUpcomingMatches] = useState([]);

  useEffect(() => {
    // Fetch upcoming matches for next 7 days
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    fetchFixtures({
      from: today.toISOString(),
      to: nextWeek.toISOString(),
      status: 'NOT_STARTED'
    });
  }, [fetchFixtures]);

  useEffect(() => {
    if (fixtures?.length) {
      // Sort by date and take first 5
      const sorted = [...fixtures]
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 5);
      setUpcomingMatches(sorted);
    }
  }, [fixtures]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="divide-y divide-gray-200">
      {upcomingMatches.map((match) => {
        const prediction = userPredictions.find(p => p.fixture_id === match.fixture_id);
        const matchDate = new Date(match.date);

        return (
          <Link
            key={match.fixture_id}
            to={prediction 
              ? `/predictions/${prediction.id}` 
              : `/predictions/new?match=${match.fixture_id}`}
            className="block hover:bg-gray-50 transition-colors"
          >
            <div className="p-4">
              {/* Date and Time */}
              <div className="text-sm text-gray-500 mb-2">
                {matchDate.toLocaleDateString([], {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric'
                })}
                {' • '}
                {matchDate.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>

              {/* Teams and Prediction Status */}
              <div className="grid grid-cols-7 items-center gap-2">
                {/* Home Team */}
                <div className="col-span-3 flex items-center space-x-2">
                  <img
                    src={match.home_team_logo}
                    alt={`${match.home_team} logo`}
                    className="h-6 w-6 object-contain"
                  />
                  <span className="font-medium truncate">{match.home_team}</span>
                </div>

                {/* VS or Prediction */}
                <div className="col-span-1 text-center">
                  {prediction ? (
                    <span className="text-sm font-medium">
                      {prediction.score1}-{prediction.score2}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-500">vs</span>
                  )}
                </div>

                {/* Away Team */}
                <div className="col-span-3 flex items-center justify-end space-x-2">
                  <span className="font-medium truncate">{match.away_team}</span>
                  <img
                    src={match.away_team_logo}
                    alt={`${match.away_team} logo`}
                    className="h-6 w-6 object-contain"
                  />
                </div>
              </div>

              {/* League and Prediction Status */}
              <div className="mt-2 flex justify-between items-center text-sm">
                <span className="text-gray-500">{match.league}</span>
                {prediction ? (
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                    Prediction Made
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                    Predict Now
                  </span>
                )}
              </div>
            </div>
          </Link>
        );
      })}

      {/* Show message if no upcoming matches */}
      {upcomingMatches.length === 0 && (
        <div className="p-6 text-center text-gray-500">
          No upcoming matches in the next 7 days
        </div>
      )}

      {/* Link to all matches */}
      <div className="p-4 bg-gray-50">
        <Link
          to="/matches"
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          View all upcoming matches →
        </Link>
      </div>
    </div>
  );
};

export default UpcomingMatches;