// src/contexts/UserContext.js
import React, { createContext, useContext, useState, useCallback } from 'react';
import { usersApi } from '../api';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';

const UserContext = createContext(null);

export const UserProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { showError } = useNotifications();
  
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchProfile = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await usersApi.getUserProfile();
      
      if (response.status === 'success') {
        setProfile(response.data.user);
        setStats(response.data.stats);
      } else {
        // Don't throw an error here, just log it
        console.warn("Profile fetch returned non-success status:", response.message);
        // Use cached profile if available or set default values
        if (!profile) {
          setProfile({ username: "User" });
          setStats({ total_points: 0, total_predictions: 0, average_points: 0 });
        }
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
      setError("Unable to load profile data. Using cached data.");
      
      // Use cached profile if available or set default values
      if (!profile) {
        setProfile({ username: "User" });
        setStats({ total_points: 0, total_predictions: 0, average_points: 0 });
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, profile]);

  const updateProfile = useCallback(async (userData) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await usersApi.updateUserProfile(userData);
      
      if (response.status === 'success') {
        // Refetch the profile to get the updated data
        await fetchProfile();
        return true;
      } else {
        throw new Error(response.message || 'Failed to update profile');
      }
    } catch (err) {
      setError(err.message || 'Failed to update profile');
      showError(err.message || 'Failed to update profile');
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchProfile, showError]);

  const getUserStats = useCallback(async (userId) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await usersApi.getUserStats(userId);
      
      if (response.status === 'success') {
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to fetch user stats');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch user stats');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearUserData = useCallback(() => {
    setProfile(null);
    setStats(null);
    setError(null);
  }, []);

  return (
    <UserContext.Provider
      value={{
        profile,
        stats,
        loading,
        error,
        fetchProfile,
        updateProfile,
        getUserStats,
        clearUserData
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export default UserContext;