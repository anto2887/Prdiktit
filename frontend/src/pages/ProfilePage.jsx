// src/pages/ProfilePage.jsx
import React, { useEffect } from 'react';
import { useUser, usePredictions } from '../contexts/AppContext';

// Components
import Profile from '../components/dashboard/Profile';
import PredictionStats from '../components/predictions/PredictionStats';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';

const ProfilePage = () => {
  const { fetchProfile, loading: profileLoading, error: profileError } = useUser();
  const { fetchUserPredictions, loading: predictionsLoading, error: predictionsError } = usePredictions();

  // Combined loading and error states
  const isLoading = profileLoading || predictionsLoading;
  const error = profileError || predictionsError;

  useEffect(() => {
    fetchProfile();
    fetchUserPredictions();
  }, [fetchProfile, fetchUserPredictions]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  return (
    <div className="space-y-8">
      <Profile />
      <PredictionStats />
    </div>
  );
};

export default ProfilePage;