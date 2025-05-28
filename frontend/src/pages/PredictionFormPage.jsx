// src/pages/PredictionFormPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { usePredictions, useMatches, useNotifications } from '../contexts/AppContext';

// Components
import PredictionForm from '../components/predictions/PredictionForm';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';

const PredictionFormPage = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const matchId = searchParams.get('match');
  const navigate = useNavigate();
  
  const { 
    fetchPrediction, 
    createPrediction, 
    updatePrediction, 
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
  
  // Combined loading and error states
  const isLoading = predictionLoading || matchLoading;
  const error = predictionError || matchError;

  useEffect(() => {
    const loadData = async () => {
      // If we have a prediction ID, fetch the prediction
      if (id) {
        const predictionData = await fetchPrediction(id);
        setPrediction(predictionData);
        
        // Also fetch the associated match
        if (predictionData?.fixture_id) {
          await fetchMatchById(predictionData.fixture_id);
        }
      } 
      // If we have a match ID from the query params, fetch that match
      else if (matchId) {
        await fetchMatchById(matchId);
      }
    };
    
    loadData();
  }, [id, matchId, fetchPrediction, fetchMatchById]);

  const handleSubmit = async (predictionData) => {
    try {
      if (id) {
        // Update existing prediction
        await updatePrediction(id, predictionData);
        showSuccess('Prediction updated successfully');
      } else {
        // Create new prediction
        await createPrediction({
          ...predictionData,
          fixture_id: selectedMatch.fixture_id
        });
        showSuccess('Prediction created successfully');
      }
      navigate('/predictions');
    } catch (err) {
      showError(err.message || 'Failed to save prediction');
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  if (!selectedMatch) {
    return <ErrorMessage message="Match not found" />;
  }

  return (
    <PredictionForm 
      match={selectedMatch} 
      initialPrediction={prediction} 
      onSubmit={handleSubmit} 
    />
  );
};

export default PredictionFormPage;