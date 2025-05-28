// src/pages/SettingsPage.jsx
import React, { useEffect } from 'react';
import { useUser } from '../contexts/AppContext';

// Components
import Settings from '../components/dashboard/Settings';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';

const SettingsPage = () => {
  const { fetchProfile, loading, error } = useUser();

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  return <Settings />;
};

export default SettingsPage;