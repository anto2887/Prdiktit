// src/pages/PredictionHistoryPage.jsx
import React, { useEffect } from 'react';
import { usePredictions } from '../contexts/PredictionContext';

// Components
import PredictionHistory from '../components/predictions/PredictionHistory';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';

const PredictionHistoryPage = () => {
  const { fetchUserPredictions, loading, error } = usePredictions();

  useEffect(() => {
    fetchUserPredictions();
  }, [fetchUserPredictions]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  return <PredictionHistory />;
};

export default PredictionHistoryPage;