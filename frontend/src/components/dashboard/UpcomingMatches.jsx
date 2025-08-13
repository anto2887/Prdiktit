import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMatches, usePredictions } from '../../contexts/AppContext';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import TimezoneIndicator from '../common/TimezoneIndicator';
import { formatKickoffTime, formatShortDate } from '../../utils/dateUtils';

const UpcomingMatches = () => {
  const { fixtures, fetchFixtures, loading, error } = useMatches();
  const { userPredictions } = usePredictions();
  const [upcomingMatches, setUpcomingMatches] = useState([]);

  useEffect(() => {
    // Fetch upcoming matches for next 7 days (starting from now, not from today)
    const now = new Date();
    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() + 7);

    fetchFixtures({
      from: now.toISOString(),
      to: nextWeek.toISOString(),
      status: 'NOT_STARTED'
    });
  }, [fetchFixtures]);

  useEffect(() => {
    if (fixtures?.length) {
      // Filter for truly upcoming matches (future dates + NOT_STARTED status)
      const now = new Date();
      const upcomingOnly = fixtures.filter(match => {
        const matchDate = new Date(match.date);
        return matchDate > now && match.status === 'NOT_STARTED';
      });
      
      // Sort by date and take first 5
      const sorted = upcomingOnly
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 5);
      setUpcomingMatches(sorted);
    }
  }, [fixtures]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="divide-y divide-gray-200">
      {/* Timezone indicator header */}
      <div className="p-4 bg-gray-50 border-b">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Upcoming Matches</h3>
          <TimezoneIndicator showDetails={false} />
        </div>
      </div>

      {upcomingMatches.map((match) => {
        const prediction = userPredictions.find(p => p.fixture_id === match.fixture_id);

        return (
          <Link
            key={match.fixture_id}
            to={prediction 
              ? `/predictions/${prediction.id}` 
              : `/predictions/new?match=${match.fixture_id}`}
            className="block hover:bg-gray-50 transition-colors"
          >
            <div className="p-4">
              {/* Date and Time - FIXED: Using timezone utilities */}
              <div className="text-sm text-gray-500 mb-2">
                {formatKickoffTime(match.date)}
              </div>

              {/* Teams and Prediction Status */}
              <div className="grid grid-cols-7 items-center gap-2">
                {/* Home Team */}
                <div className="col-span-3 flex items-center space-x-2">
                  <img
                    src={match.home_team_logo || '/placeholder-logo.svg'}
                    alt={`${match.home_team} logo`}
                    className="h-6 w-6 object-contain"
                    onError={(e) => { e.target.src = '/placeholder-logo.svg'; }}
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
                    src={match.away_team_logo || '/placeholder-logo.svg'}
                    alt={`${match.away_team} logo`}
                    className="h-6 w-6 object-contain"
                    onError={(e) => { e.target.src = '/placeholder-logo.svg'; }}
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
          <p className="mb-2">No upcoming matches available for prediction</p>
          <p className="text-sm text-gray-400">Check back later for new fixtures</p>
        </div>
      )}

      {/* Link to all matches */}
      <div className="p-4 bg-gray-50">
        <Link
          to="/predictions"
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          View all upcoming matches →
        </Link>
      </div>
    </div>
  );
};

export default UpcomingMatches;