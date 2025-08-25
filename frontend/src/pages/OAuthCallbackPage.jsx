import React from 'react';
import OAuthCallback from '../components/auth/OAuthCallback';
import { useAuth, useNotifications } from '../contexts';
import { useNavigate } from 'react-router-dom';

const OAuthCallbackPage = () => {
  const { login } = useAuth();
  const { showSuccess, showError } = useNotifications();
  const navigate = useNavigate();

  const handleOAuthSuccess = async (data) => {
    try {
      if (data.access_token) {
        // Store the token
        localStorage.setItem('access_token', data.access_token);
        
        if (data.user_exists) {
          // Existing user - login successful
          showSuccess('Successfully logged in with Google');
        } else {
          // New user - account created
          showSuccess('Account created successfully! Welcome to PrdiktIt');
        }
        
        // Redirect to dashboard
        navigate('/dashboard', { replace: true });
      }
    } catch (error) {
      console.error('OAuth success handling error:', error);
      showError('Failed to complete authentication');
      navigate('/login', { replace: true });
    }
  };

  const handleOAuthError = (error) => {
    console.error('OAuth error:', error);
    showError(error.message || 'OAuth authentication failed');
    navigate('/login', { replace: true });
  };

  return (
    <OAuthCallback
      onSuccess={handleOAuthSuccess}
      onError={handleOAuthError}
    />
  );
};

export default OAuthCallbackPage;
