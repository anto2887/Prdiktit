// src/components/auth/ProtectedRoute.jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts';
import LoadingSpinner from '../common/LoadingSpinner';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  console.log('🔒 ProtectedRoute Debug:', {
    isAuthenticated,
    loading,
    user: user ? 'User exists' : 'No user',
    pathname: location.pathname,
    timestamp: new Date().toISOString()
  });

  if (loading) {
    console.log('🔄 ProtectedRoute: Showing loading spinner');
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    console.log('❌ ProtectedRoute: Not authenticated, redirecting to login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  console.log('✅ ProtectedRoute: Authenticated, rendering children');
  return children;
};

export default ProtectedRoute;