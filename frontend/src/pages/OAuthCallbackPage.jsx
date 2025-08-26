import React from 'react';
import OAuthCallback from '../components/auth/OAuthCallback';
import { useAuth, useNotifications } from '../contexts';
import { useNavigate } from 'react-router-dom';

const OAuthCallbackPage = () => {
  const { loginWithOAuth } = useAuth();
  const { showSuccess, showError } = useNotifications();
  const navigate = useNavigate();

  const handleOAuthSuccess = async (data) => {
    try {
      // Use the new OAuth-specific login function
      const result = await loginWithOAuth(data);
      
      if (result.requires_username) {
        // New OAuth user needs to select username - redirect to username selection
        navigate('/username-selection', { 
          replace: true, 
          state: { oauth_data: result.oauth_data } 
        });
        return;
      }
      
      if (result.success) {
        if (data.user_exists) {
          // Existing user - login successful
          showSuccess('Successfully logged in with Google');
        } else {
          // New user - account created
          showSuccess('Account created successfully! Welcome to PrdiktIt');
        }
        
        // Now redirect to dashboard after authentication state is updated
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
