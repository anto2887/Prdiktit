// src/pages/PredictionsPage.jsx
import React, { useEffect } from 'react';
import { usePredictions, useMatches, useGroups } from '../contexts/AppContext';

// Components
import PredictionList from '../components/predictions/PredictionList';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';

const PredictionsPage = () => {
  const { fetchUserPredictions, loading: predictionsLoading, error: predictionsError } = usePredictions();
  const { fetchFixtures, loading: matchesLoading, error: matchesError } = useMatches();
  const { fetchUserGroups, loading: groupsLoading, error: groupsError } = useGroups();

  // Combined loading and error states
  const isLoading = predictionsLoading || matchesLoading || groupsLoading;
  const errors = [predictionsError, matchesError, groupsError].filter(Boolean);

  useEffect(() => {
    fetchUserPredictions();
  }, [fetchUserGroups, fetchFixtures]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (errors.length > 0) {
    return <ErrorMessage message={errors[0]} />;
  }

  return <PredictionList />;
};

export default PredictionsPage;