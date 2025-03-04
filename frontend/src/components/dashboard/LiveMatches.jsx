import React from 'react';
import { Link } from 'react-router-dom';

const LiveScore = ({ score, pulseColor = 'bg-red-500' }) => (
  <div className="flex items-center space-x-2">
    <span className="text-xl font-bold">{score}</span>
    <span className={`h-2 w-2 ${pulseColor} rounded-full animate-pulse`}></span>
  </div>
);

const LiveMatches = ({ matches }) => {
  const getStatusColor = (status) => {
    const colors = {
      'FIRST_HALF': 'bg-green-500',
      'SECOND_HALF': 'bg-green-500',
      'HALFTIME': 'bg-yellow-500',
      'EXTRA_TIME': 'bg-red-500',
      'PENALTY': 'bg-purple-500'
    };
    return colors[status] || 'bg-gray-500';
  };

  return (
    <div className="divide-y divide-gray-200">
      {matches.map((match) => (
        <Link
          key={match.fixture_id}
          to={`/matches/${match.fixture_id}`}
          className="block hover:bg-gray-50 transition-colors"
        >
          <div className="p-6">
            <div className="flex items-center justify-between">
              {/* Status */}
              <div className="flex items-center space-x-2">
                <span className={`inline-block h-2 w-2 rounded-full ${getStatusColor(match.status)}`}></span>
                <span className="text-sm font-medium text-gray-500">
                  {match.status.replace('_', ' ')}
                </span>
              </div>
              
              {/* Time */}
              <span className="text-sm text-gray-500">
                {new Date(match.date).toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-7 items-center">
              {/* Home Team */}
              <div className="col-span-3 flex items-center space-x-3">
                <img
                  src={match.home_team_logo}
                  alt={`${match.home_team} logo`}
                  className="h-8 w-8 object-contain"
                />
                <span className="font-medium truncate">{match.home_team}</span>
              </div>

              {/* Score */}
              <div className="col-span-1 text-center">
                <LiveScore 
                  score={`${match.home_score} - ${match.away_score}`}
                  pulseColor={getStatusColor(match.status)}
                />
              </div>

              {/* Away Team */}
              <div className="col-span-3 flex items-center justify-end space-x-3">
                <span className="font-medium truncate">{match.away_team}</span>
                <img
                  src={match.away_team_logo}
                  alt={`${match.away_team} logo`}
                  className="h-8 w-8 object-contain"
                />
              </div>
            </div>

            {/* Venue */}
            {match.venue_city && (
              <div className="mt-2 text-sm text-gray-500 text-center">
                {match.venue_city}
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
};

export default LiveMatches;