import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

/**
 * Used on /login and /register when the user is already authenticated.
 * Sends them to the route they tried to open (ProtectedRoute passes state.from) or dashboard.
 */
export default function PostAuthRedirect({ fallback = '/dashboard' }) {
  const location = useLocation();
  const from = location.state?.from;
  const path =
    from && typeof from.pathname === 'string' && from.pathname && from.pathname !== '/login'
      ? `${from.pathname}${from.search || ''}${from.hash || ''}`
      : fallback;
  return <Navigate to={path} replace />;
}
