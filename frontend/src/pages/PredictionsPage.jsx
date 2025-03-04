// src/pages/PredictionsPage.jsx
import React, { useEffect } from 'react';
import { usePredictions } from '../contexts/PredictionContext';
import { useMatches } from '../contexts/MatchContext';
import { useGroups } from '../contexts/GroupContext';

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
    // Fetch initial data
    fetchUserPredictions();
    fetchUserGroups();
    
    // Get upcoming matches for next 7 days
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    
    fetchFixtures({
      from: today.toISOString(),
      to: nextWeek.toISOString(),
      status: 'NOT_STARTED'
    });
  }, [fetchUserPredictions, fetchUserGroups, fetchFixtures]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (errors.length > 0) {
    return <ErrorMessage message={errors[0]} />;
  }

  return <PredictionList />;
};

export default PredictionsPage;