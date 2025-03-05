// src/contexts/PredictionContext.js
import React, { createContext, useContext, useState, useCallback } from 'react';
import { predictionsApi } from '../api';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';

const PredictionContext = createContext(null);

export const PredictionProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { showSuccess, showError } = useNotifications();
  
  const [userPredictions, setUserPredictions] = useState([]);
  const [selectedPrediction, setSelectedPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchUserPredictions = useCallback(async (params = {}) => {
    if (!isAuthenticated) return [];
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await predictionsApi.getUserPredictions(params);
      
      if (response.status === 'success') {
        setUserPredictions(response.data);
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to fetch predictions');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch predictions');
      showError(err.message || 'Failed to fetch predictions');
      return [];
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, showError]);

  const fetchPrediction = useCallback(async (predictionId) => {
    if (!isAuthenticated || !predictionId) return null;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await predictionsApi.getPredictionById(predictionId);
      
      if (response.status === 'success') {
        setSelectedPrediction(response.data);
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to fetch prediction');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch prediction');
      showError(err.message || 'Failed to fetch prediction');
      return null;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, showError]);

  const createPrediction = useCallback(async (predictionData) => {
    if (!isAuthenticated) return null;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await predictionsApi.createPrediction(predictionData);
      
      if (response.status === 'success') {
        // Refresh predictions list
        await fetchUserPredictions();
        showSuccess('Prediction submitted successfully');
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to create prediction');
      }
    } catch (err) {
      setError(err.message || 'Failed to create prediction');
      showError(err.message || 'Failed to create prediction');
      return null;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, fetchUserPredictions, showSuccess, showError]);

  const updatePrediction = useCallback(async (predictionId, predictionData) => {
    if (!isAuthenticated || !predictionId) return null;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await predictionsApi.updatePrediction(predictionId, predictionData);
      
      if (response.status === 'success') {
        // Refresh predictions list
        await fetchUserPredictions();
        showSuccess('Prediction updated successfully');
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to update prediction');
      }
    } catch (err) {
      setError(err.message || 'Failed to update prediction');
      showError(err.message || 'Failed to update prediction');
      return null;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, fetchUserPredictions, showSuccess, showError]);

  const resetPrediction = useCallback(async (predictionId) => {
    if (!isAuthenticated || !predictionId) return null;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await predictionsApi.resetPrediction(predictionId);
      
      if (response.status === 'success') {
        // Refresh predictions list
        await fetchUserPredictions();
        showSuccess('Prediction reset successfully');
        return true;
      } else {
        throw new Error(response.message || 'Failed to reset prediction');
      }
    } catch (err) {
      setError(err.message || 'Failed to reset prediction');
      showError(err.message || 'Failed to reset prediction');
      return false;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, fetchUserPredictions, showSuccess, showError]);

  const submitBatchPredictions = useCallback(async (predictions) => {
    if (!isAuthenticated) return null;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await predictionsApi.createBatchPredictions(predictions);
      
      if (response.status === 'success') {
        // Refresh predictions list
        await fetchUserPredictions();
        showSuccess('Predictions submitted successfully');
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to submit predictions');
      }
    } catch (err) {
      setError(err.message || 'Failed to submit predictions');
      showError(err.message || 'Failed to submit predictions');
      return null;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, fetchUserPredictions, showSuccess, showError]);

  const clearPredictionData = useCallback(() => {
    setUserPredictions([]);
    setSelectedPrediction(null);
    setError(null);
  }, []);

  return (
    <PredictionContext.Provider
      value={{
        userPredictions,
        selectedPrediction,
        loading,
        error,
        fetchUserPredictions,
        fetchPrediction,
        createPrediction,
        updatePrediction,
        resetPrediction,
        submitBatchPredictions,
        clearPredictionData
      }}
    >
      {children}
    </PredictionContext.Provider>
  );
};

export const usePredictions = () => {
  const context = useContext(PredictionContext);
  if (!context) {
    throw new Error('usePredictions must be used within a PredictionProvider');
  }
  return context;
};

export default PredictionContext;