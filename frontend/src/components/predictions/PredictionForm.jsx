import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { useGroups } from '../../contexts/GroupContext';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import { useMatches } from '../../contexts/MatchContext';
import { usePredictions } from '../../contexts/PredictionContext';

const PredictionForm = () => {
  const navigate = useNavigate();
  const { userGroups } = useGroups();
  const { profile } = useUser();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [predictions, setPredictions] = useState({});
  const { fetchUpcomingMatches } = useMatches();
  const { createBatchPredictions } = usePredictions();

  useEffect(() => {
    if (userGroups.length === 0) {
      setLoading(false);
      return;
    }
    
    fetchUpcomingMatches();
  }, [userGroups]);

  const handlePredictionChange = (matchId, team, score) => {
    setPredictions(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [team]: score
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createBatchPredictions(predictions);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleClear = () => {
    setPredictions({});
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (userGroups.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            You're not in any leagues yet
          </h3>
          <p className="text-gray-500 mb-4">
            Join a league to start making predictions
          </p>
          <Link
            to="/groups/join"
            className="text-blue-600 hover:text-blue-800"
          >
            Join a League →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Post Predictions</h1>
        <Link
          to="/dashboard"
          className="text-blue-600 hover:text-blue-800"
        >
          ← Back to Dashboard
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {matches.map(match => (
          <div key={match.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <img src={match.homeTeam.logo} alt="" className="w-8 h-8" />
                <input
                  type="number"
                  min="0"
                  className="w-16 px-3 py-2 border rounded-md"
                  value={predictions[match.id]?.home || ''}
                  onChange={(e) => handlePredictionChange(match.id, 'home', e.target.value)}
                  disabled={new Date(match.kickoff) <= new Date()}
                />
                <span className="text-gray-500">vs</span>
                <input
                  type="number"
                  min="0"
                  className="w-16 px-3 py-2 border rounded-md"
                  value={predictions[match.id]?.away || ''}
                  onChange={(e) => handlePredictionChange(match.id, 'away', e.target.value)}
                  disabled={new Date(match.kickoff) <= new Date()}
                />
                <img src={match.awayTeam.logo} alt="" className="w-8 h-8" />
              </div>
              <div className="text-sm text-gray-500">
                Kickoff: {new Date(match.kickoff).toLocaleString()}
              </div>
            </div>
          </div>
        ))}

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={handleClear}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Clear
          </button>
          <button
            type="submit"
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Post Predictions
          </button>
        </div>
      </form>
    </div>
  );
};

export default PredictionForm;