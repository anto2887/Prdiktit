// src/pages/PredictionFormPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { usePredictions, useMatches, useNotifications } from '../contexts/AppContext';

// Components
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import { formatKickoffTime, formatDeadlineTime, isDateInPast } from '../utils/dateUtils';

const PredictionFormPage = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const matchId = searchParams.get('match');
  const navigate = useNavigate();
  
  const { 
    fetchPrediction, 
    createPrediction, 
    updatePrediction,
    fetchUserPredictions,
    userPredictions,
    loading: predictionLoading, 
    error: predictionError 
  } = usePredictions();
  
  const { 
    fetchMatchById, 
    selectedMatch,
    loading: matchLoading, 
    error: matchError 
  } = useMatches();
  
  const { showSuccess, showError } = useNotifications();
  
  const [prediction, setPrediction] = useState(null);
  const [match, setMatch] = useState(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [existingPrediction, setExistingPrediction] = useState(null);
  
  useEffect(() => {
    const loadData = async () => {
      setIsInitialLoading(true);
      
      try {
        // If we have a prediction ID, fetch the prediction
        if (id) {
          const predictionData = await fetchPrediction(id);
          setPrediction(predictionData);
          setHomeScore(predictionData?.score1?.toString() || '');
          setAwayScore(predictionData?.score2?.toString() || '');
          
          // Also fetch the associated match
          if (predictionData?.fixture_id) {
            const matchData = await fetchMatchById(predictionData.fixture_id);
            setMatch(matchData || selectedMatch);
          }
        } 
        // If we have a match ID from the query params, fetch that match and check for existing prediction
        else if (matchId) {
          const matchData = await fetchMatchById(parseInt(matchId));
          setMatch(matchData || selectedMatch);
          
          // Check if user already has a prediction for this match
          await fetchUserPredictions();
        }
      } catch (err) {
        process.env.NODE_ENV === 'development' && console.error('Error loading data:', err);
        showError('Failed to load match details');
      } finally {
        setIsInitialLoading(false);
      }
    };
    
    loadData();
  }, [id, matchId, fetchPrediction, fetchMatchById, fetchUserPredictions]);

  // Check for existing prediction when userPredictions or match changes
  useEffect(() => {
    if (userPredictions && match && !id) {
      const existing = userPredictions.find(p => p.fixture_id === match.fixture_id);
      if (existing) {
        setExistingPrediction(existing);
        setHomeScore(existing.score1?.toString() || '');
        setAwayScore(existing.score2?.toString() || '');
      }
    }
  }, [userPredictions, match, id]);

  // Also update match state when selectedMatch changes
  useEffect(() => {
    if (selectedMatch && !match) {
      setMatch(selectedMatch);
    }
  }, [selectedMatch, match]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    process.env.NODE_ENV === 'development' && console.log('Form submission - Raw values:', { homeScore, awayScore });
    
    // Check if scores are provided (including 0)
    if (homeScore === '' || awayScore === '') {
      showError('Please enter scores for both teams');
      return;
    }

    // Validate scores are numbers
    const homeScoreNum = parseInt(homeScore);
    const awayScoreNum = parseInt(awayScore);
    
    process.env.NODE_ENV === 'development' && console.log('Parsed numbers:', { homeScoreNum, awayScoreNum });
    
    if (isNaN(homeScoreNum) || isNaN(awayScoreNum)) {
      showError('Scores must be valid numbers');
      return;
    }

    if (homeScoreNum < 0 || awayScoreNum < 0 || homeScoreNum > 20 || awayScoreNum > 20) {
      showError('Scores must be between 0 and 20');
      return;
    }

    const predictionData = {
      match_id: match?.fixture_id || parseInt(matchId),
      home_score: homeScoreNum,
      away_score: awayScoreNum
    };

    process.env.NODE_ENV === 'development' && console.log('Final prediction data being sent:', predictionData);

    try {
      if (id || existingPrediction) {
        // Update existing prediction
        const predictionId = id || existingPrediction.id;
        process.env.NODE_ENV === 'development' && console.log('Updating prediction with ID:', predictionId);
        await updatePrediction(predictionId, {
          home_score: homeScoreNum,
          away_score: awayScoreNum
        });
        showSuccess('Prediction updated successfully');
      } else {
        // Create new prediction
        process.env.NODE_ENV === 'development' && console.log('Creating new prediction with data:', predictionData);
        await createPrediction(predictionData);
        showSuccess('Prediction created successfully');
        
        // Trigger dashboard refresh by dispatching custom event
        window.dispatchEvent(new CustomEvent('predictionsUpdated'));
        localStorage.setItem('predictions_updated', Date.now().toString());
      }
      
      // Force a refresh of predictions data with a small delay
      setTimeout(async () => {
        await fetchUserPredictions();
      }, 500);
      
      navigate('/dashboard'); // Navigate to dashboard to see the updated predictions
    } catch (err) {
      process.env.NODE_ENV === 'development' && console.error('Prediction submission error:', err);
      process.env.NODE_ENV === 'development' && console.error('Error details:', {
        message: err.message,
        response: err.response,
        status: err.status
      });
      showError(err.message || 'Failed to save prediction');
    }
  };

  // Show loading only during initial data fetch
  if (isInitialLoading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <LoadingSpinner />
      </div>
    );
  }

  // Show error if there's an error
  const error = predictionError || matchError;
  if (error) {
    return <ErrorMessage message={error} />;
  }

  // Use the match from state or selectedMatch
  const currentMatch = match || selectedMatch;
  
  if (!currentMatch && !isInitialLoading) {
    return (
      <ErrorMessage 
        message="Match not found. Please try again." 
        onRetry={() => window.location.reload()}
      />
    );
  }

  // Check if prediction deadline has passed (kickoff time)
  const isDeadlinePassed = currentMatch?.prediction_deadline 
    ? isDateInPast(currentMatch.prediction_deadline)
    : currentMatch?.date 
      ? isDateInPast(currentMatch.date)
      : false;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {id || existingPrediction ? 'Edit Prediction' : 'Make Prediction'}
          </h1>
          <button
            onClick={() => navigate('/predictions')}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {currentMatch && (
          <>
            {/* Match details */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 mb-4">
                    <div className="flex items-center space-x-2">
                      {currentMatch.home_team_logo ? (
                        <img 
                          src={currentMatch.home_team_logo} 
                          alt={currentMatch.home_team}
                          className="w-8 h-8 object-contain"
                          onError={(e) => { 
                            e.target.style.display = 'none';
                            e.target.nextElementSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center" style={{ display: currentMatch.home_team_logo ? 'none' : 'flex' }}>
                        <span className="text-gray-500 text-sm">⚽</span>
                      </div>
                      <span className="text-lg font-medium">{currentMatch.home_team}</span>
                    </div>
                    
                    <span className="text-gray-400 text-lg">vs</span>
                    
                    <div className="flex items-center space-x-2">
                      <span className="text-lg font-medium">{currentMatch.away_team}</span>
                      {currentMatch.away_team_logo ? (
                        <img 
                          src={currentMatch.away_team_logo} 
                          alt={currentMatch.away_team}
                          className="w-8 h-8 object-contain"
                          onError={(e) => { 
                            e.target.style.display = 'none';
                            e.target.nextElementSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center" style={{ display: currentMatch.away_team_logo ? 'none' : 'flex' }}>
                        <span className="text-gray-500 text-sm">⚽</span>
                      </div>
                    </div>
                  </div>
              
              <div className="mt-3 text-sm text-gray-600 text-center">
                <p>{currentMatch.league} • {currentMatch.season}</p>
                {(() => {
                  const deadline = currentMatch.prediction_deadline || currentMatch.date;
                  if (!deadline) return null;
                  
                  const { text, urgency } = formatDeadlineTime(deadline);
                  
                  return (
                    <p className={`mt-1 font-medium ${
                      urgency === 'critical' ? 'text-red-600' :
                      urgency === 'high' ? 'text-orange-600' :
                      urgency === 'medium' ? 'text-yellow-600' :
                      urgency === 'expired' ? 'text-red-500' :
                      'text-blue-600'
                    }`}>
                      ⏰ Predictions close: {text}
                    </p>
                  );
                })()}
              </div>
            </div>

            {/* Show existing prediction info if editing */}
            {(id || existingPrediction) && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <p className="text-blue-800 font-medium">
                    You already have a prediction for this match. You can modify it until the deadline.
                  </p>
                </div>
              </div>
            )}

            {/* Prediction form */}
            {isDeadlinePassed ? (
              <div className="text-center py-8">
                <p className="text-red-600 font-medium">
                  ⚠️ This match has kicked off. Predictions are no longer accepted.
                </p>
                <p className="text-gray-600 text-sm mt-2">
                  Kickoff was: {currentMatch.date ? formatKickoffTime(currentMatch.date) : 'Unknown time'}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Your Prediction</h3>
                  
                  <div className="flex items-center justify-center space-x-8">
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        {currentMatch.home_team}
                      </p>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={homeScore}
                        onChange={(e) => {
                          process.env.NODE_ENV === 'development' && console.log('Home score input changed:', e.target.value);
                          setHomeScore(e.target.value);
                        }}
                        className="w-20 h-12 text-center text-xl font-bold border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0"
                        required
                      />
                    </div>
                    
                    <div className="text-2xl font-bold text-gray-400">-</div>
                    
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        {currentMatch.away_team}
                      </p>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={awayScore}
                        onChange={(e) => {
                          process.env.NODE_ENV === 'development' && console.log('Away score input changed:', e.target.value);
                          setAwayScore(e.target.value);
                        }}
                        className="w-20 h-12 text-center text-xl font-bold border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={() => navigate('/predictions')}
                    className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={predictionLoading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {predictionLoading ? 'Saving...' : (id || existingPrediction ? 'Update Prediction' : 'Save Prediction')}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PredictionFormPage;