// src/pages/PredictionsPage.jsx
import React, { useEffect, useState } from 'react';
import { usePredictions, useMatches, useGroups } from '../contexts/AppContext';

// Components
import PredictionList from '../components/predictions/PredictionList';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';

const PredictionsPage = () => {
  const { fetchUserPredictions, loading: predictionsLoading, error: predictionsError } = usePredictions();
  const { fetchFixtures, loading: matchesLoading, error: matchesError } = useMatches();
  const { fetchUserGroups, loading: groupsLoading, error: groupsError } = useGroups();

  // Local loading state that we fully control
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [dataFetchStatus, setDataFetchStatus] = useState({
    groups: false,
    fixtures: false,
    predictions: false
  });

  // Combined error state
  const errors = [predictionsError, matchesError, groupsError].filter(Boolean);

  // FIXED: Proper sequential data fetching with safe dependencies
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        process.env.NODE_ENV === 'development' && console.log('PredictionsPage: Starting data fetch sequence');
        
        // STEP 1: Fetch user groups first (needed for fixture filtering)
        if (!dataFetchStatus.groups) {
          try {
            process.env.NODE_ENV === 'development' && console.log('PredictionsPage: Fetching user groups...');
            await fetchUserGroups();
            setDataFetchStatus(prev => ({ ...prev, groups: true }));
            process.env.NODE_ENV === 'development' && console.log('PredictionsPage: User groups fetched successfully');
          } catch (error) {
            process.env.NODE_ENV === 'development' && console.error("PredictionsPage: Failed to fetch groups:", error);
          }
          
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        // STEP 2: Fetch fixtures (depends on groups for filtering)
        if (!dataFetchStatus.fixtures) {
          try {
            process.env.NODE_ENV === 'development' && console.log('PredictionsPage: Fetching fixtures...');
            await fetchFixtures();
            setDataFetchStatus(prev => ({ ...prev, fixtures: true }));
            process.env.NODE_ENV === 'development' && console.log('PredictionsPage: Fixtures fetched successfully');
          } catch (error) {
            process.env.NODE_ENV === 'development' && console.error("PredictionsPage: Failed to fetch fixtures:", error);
          }
          
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        // STEP 3: Fetch user predictions
        if (!dataFetchStatus.predictions) {
          try {
            process.env.NODE_ENV === 'development' && console.log('PredictionsPage: Fetching user predictions...');
            await fetchUserPredictions();
            setDataFetchStatus(prev => ({ ...prev, predictions: true }));
            process.env.NODE_ENV === 'development' && console.log('PredictionsPage: User predictions fetched successfully');
          } catch (error) {
            process.env.NODE_ENV === 'development' && console.error("PredictionsPage: Failed to fetch predictions:", error);
          }
        }

      } catch (error) {
        process.env.NODE_ENV === 'development' && console.error('PredictionsPage: Error in data fetch sequence:', error);
      } finally {
        // CRITICAL: Always exit loading state regardless of success/failure
        setIsInitialLoading(false);
        process.env.NODE_ENV === 'development' && console.log('PredictionsPage: Initial loading completed');
      }
    };

    fetchAllData();
  }, []); // ✅ Empty dependency array - only run once on mount

  // Show initial loading spinner while fetching all required data
  if (isInitialLoading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <LoadingSpinner />
        <span className="ml-3 text-gray-500">Loading matches and predictions...</span>
      </div>
    );
  }

  // Show errors if any occurred during data fetching
  if (errors.length > 0) {
    return (
      <ErrorMessage 
        message={errors[0]} 
        title="Failed to load predictions data"
      />
    );
  }

  return <PredictionList />;
};

export default PredictionsPage;