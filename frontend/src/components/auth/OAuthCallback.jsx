import React, { useEffect, useState } from 'react';
import UsernameSelection from './UsernameSelection';

const OAuthCallback = ({ onSuccess, onError }) => {
  const [isProcessing, setIsProcessing] = useState(true);
  const [oauthData, setOauthData] = useState(null);
  const [requiresUsername, setRequiresUsername] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    processOAuthCallback();
  }, []);

  const processOAuthCallback = async () => {
    try {
      // Get the authorization code from URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');

      if (!code) {
        throw new Error('No authorization code received from Google');
      }

      // Exchange the code for user data
      const response = await fetch(`/api/v1/oauth/google/callback?code=${code}&state=${state || ''}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'OAuth callback failed');
      }

      const data = await response.json();

      if (data.user_exists) {
        // User already exists, login successful
        onSuccess?.(data);
      } else if (data.requires_username) {
        // New user needs to choose username
        setOauthData(data.oauth_data);
        setRequiresUsername(true);
      } else {
        throw new Error('Unexpected OAuth response');
      }

    } catch (error) {
      console.error('OAuth callback error:', error);
      setError(error.message || 'OAuth authentication failed');
      onError?.(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUsernameComplete = (userData) => {
    onSuccess?.(userData);
  };

  const handleUsernameCancel = () => {
    // Redirect back to login page
    window.location.href = '/login';
  };

  if (isProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Processing OAuth authentication...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6 text-center">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Authentication Failed</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.href = '/login'}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  if (requiresUsername && oauthData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-8">
        <UsernameSelection
          oauthData={oauthData}
          onComplete={handleUsernameComplete}
          onCancel={handleUsernameCancel}
        />
      </div>
    );
  }

  return null;
};

export default OAuthCallback;
