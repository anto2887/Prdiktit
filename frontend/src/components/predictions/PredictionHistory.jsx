import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usePredictions } from '../../contexts/AppContext';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import { formatDateTime, formatKickoffTime, formatShortDate, formatTime } from '../../utils/dateUtils';

export const PredictionHistory = () => {
  const { userPredictions, fetchUserPredictions, loading, error } = usePredictions();
  const [filteredPredictions, setFilteredPredictions] = useState([]);
  const [filters, setFilters] = useState({
    status: '',
    season: '',
    week: ''
  });

  useEffect(() => {
    fetchUserPredictions();
  }, [fetchUserPredictions]);

  useEffect(() => {
    if (userPredictions) {
      let filtered = [...userPredictions];
      
      if (filters.status) {
        filtered = filtered.filter(pred => pred.status === filters.status);
      }
      
      if (filters.season) {
        filtered = filtered.filter(pred => pred.season === filters.season);
      }
      
      if (filters.week) {
        filtered = filtered.filter(pred => pred.week === parseInt(filters.week));
      }
      
      // Sort by date/time (newest first)
      filtered.sort((a, b) => {
        if (!a.fixture?.date || !b.fixture?.date) return 0;
        return new Date(b.fixture.date) - new Date(a.fixture.date);
      });
      
      setFilteredPredictions(filtered);
    }
  }, [userPredictions, filters]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Get unique seasons and weeks for filters
  const seasons = [...new Set(userPredictions.map(p => p.season))].sort().reverse();
  const weeks = [...new Set(userPredictions.map(p => p.week))].sort((a, b) => b - a);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Prediction History</h1>
        <Link
          to="/predictions/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          New Prediction
        </Link>
      </div>
      
      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-md">
        <h2 className="font-medium mb-4">Filter Predictions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              className="w-full p-2 border rounded-md"
            >
              <option value="">All Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="LOCKED">Locked</option>
              <option value="PROCESSED">Processed</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Season
            </label>
            <select
              name="season"
              value={filters.season}
              onChange={handleFilterChange}
              className="w-full p-2 border rounded-md"
            >
              <option value="">All Seasons</option>
              {seasons.map(season => (
                <option key={season} value={season}>{season}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Week
            </label>
            <select
              name="week"
              value={filters.week}
              onChange={handleFilterChange}
              className="w-full p-2 border rounded-md"
            >
              <option value="">All Weeks</option>
              {weeks.map(week => (
                <option key={week} value={week}>Week {week}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      {/* Predictions List */}
      <div className="bg-white rounded-lg shadow-md">
        {filteredPredictions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No predictions match your filters</p>
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Match
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Prediction
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Result
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Points
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPredictions.map(prediction => {
                    const fixture = prediction.fixture || {};
                    const isPredictionCorrect = 
                      prediction.status === 'PROCESSED' && 
                      prediction.score1 === fixture.home_score && 
                      prediction.score2 === fixture.away_score;
                      
                    const isResultCorrect = 
                      prediction.status === 'PROCESSED' && 
                      prediction.points > 0 && 
                      !isPredictionCorrect;
                    
                    return (
                      <tr 
                        key={prediction.prediction_id}
                        className={`
                          ${isPredictionCorrect ? 'bg-green-50' : ''}
                          ${isResultCorrect ? 'bg-yellow-50' : ''}
                        `}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center">
                              <img className="h-8 w-8" src={fixture.home_team_logo} alt="" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {fixture.home_team} vs {fixture.away_team}
                              </div>
                              <div className="text-sm text-gray-500">
                                {fixture.league}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {formatShortDate(fixture.date)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatTime(fixture.date)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                          {prediction.score1} - {prediction.score2}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                          {fixture.status === 'FINISHED' || fixture.status === 'FINISHED_AET' || 
                           fixture.status === 'FINISHED_PEN' ? (
                            <span>
                              {fixture.home_score} - {fixture.away_score}
                            </span>
                          ) : (
                            <span className="text-gray-500">Pending</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {prediction.status === 'PROCESSED' ? (
                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                              +{prediction.points}
                            </span>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full
                            ${prediction.status === 'SUBMITTED' ? 'bg-green-100 text-green-800' : ''}
                            ${prediction.status === 'LOCKED' ? 'bg-yellow-100 text-yellow-800' : ''}
                            ${prediction.status === 'PROCESSED' ? 'bg-blue-100 text-blue-800' : ''}
                          `}>
                            {prediction.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PredictionHistory;