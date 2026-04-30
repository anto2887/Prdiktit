import React, { useEffect, useState } from 'react';
import UsernameSelection from './UsernameSelection';
import { useI18n } from '../../i18n';

const OAuthCallback = ({ onSuccess, onError }) => {
  const { t } = useI18n();
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
        throw new Error(t('auth.noAuthCode'));
      }

      // Exchange the code for user data - use backend URL from environment variable
      const response = await fetch(`${process.env.REACT_APP_API_URL}/oauth/google/callback?code=${code}&state=${state || ''}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || t('auth.oauthCallbackFailed'));
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
        throw new Error(t('auth.unexpectedOauthResponse'));
      }

    } catch (error) {
      console.error('OAuth callback error:', error);
      setError(error.message || t('auth.oauthAuthenticationFailed'));
      onError?.(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUsernameComplete = async (userData) => {
    try {
      // Process the completed OAuth registration through the OAuth function
      // This ensures proper authentication state is set
      await onSuccess?.(userData);
    } catch (error) {
      console.error('Error completing OAuth registration:', error);
      setError(t('auth.completeRegistrationFailed'));
    }
  };

  const handleUsernameCancel = () => {
    // Redirect back to login page
    window.location.href = '/login';
  };

  if (isProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">{t('auth.processingOauth')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
          <div className="text-red-600 dark:text-red-400 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{t('auth.authenticationFailed')}</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.href = '/login'}
            className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
          >
            {t('auth.backToLogin')}
          </button>
        </div>
      </div>
    );
  }

  if (requiresUsername && oauthData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-8">
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
