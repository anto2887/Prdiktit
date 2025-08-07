// src/pages/RivalryPage.jsx
import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AppContext';
import RivalryDashboard from '../components/rivalries/RivalryDashboard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';

const RivalryPage = () => {
  const { groupId } = useParams();
  const { user, loading } = useAuth();
  
  // Show loading while auth is being checked
  if (loading) {
    return <LoadingSpinner />;
  }
  
  // Redirect if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  // Show error if no groupId provided
  if (!groupId) {
    return <ErrorMessage message="Group ID is required" />;
  }
  
  // Get current week from user's season data or default to current week
  const getCurrentWeek = () => {
    // This should be fetched from the user's season data
    // For now, we'll use a default or get it from localStorage
    const storedWeek = localStorage.getItem('currentWeek');
    if (storedWeek) {
      return parseInt(storedWeek, 10);
    }
    
    // Fallback: calculate current week based on season start
    const seasonStart = new Date('2024-08-17'); // Premier League 2024-25 start
    const now = new Date();
    const weeksSinceStart = Math.floor((now - seasonStart) / (7 * 24 * 60 * 60 * 1000));
    return Math.max(1, Math.min(38, weeksSinceStart + 1)); // Between 1-38 weeks
  };
  
  const currentWeek = getCurrentWeek();
  const season = '2024-2025'; // This could be made dynamic based on user's group
  
  return (
    <RivalryDashboard 
      groupId={groupId}
      currentWeek={currentWeek}
      season={season}
    />
  );
};

export default RivalryPage; 