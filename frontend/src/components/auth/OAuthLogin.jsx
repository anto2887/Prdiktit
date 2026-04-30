import React, { useState } from 'react';
import { FcGoogle } from 'react-icons/fc';
import { useI18n } from '../../i18n';

const OAuthLogin = ({ onSuccess, onError, disabled = false, disabledReason = '' }) => {
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      console.log('🔐 OAuth Flow: Starting Google OAuth login...');
      console.log('🔐 OAuth Flow: Current window.location:', window.location.href);
      console.log('🔐 OAuth Flow: REACT_APP_API_URL:', process.env.REACT_APP_API_URL);
      
      // Use the backend URL from environment variable
      const apiUrl = `${process.env.REACT_APP_API_URL}/oauth/google/login`;
      console.log('🔐 OAuth Flow: Constructed API URL:', apiUrl);
      console.log('🔐 OAuth Flow: Making fetch request...');
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('🔐 OAuth Flow: Response received');
      console.log('🔐 OAuth Flow: Response status:', response.status);
      console.log('🔐 OAuth Flow: Response headers:', Object.fromEntries(response.headers.entries()));
      console.log('🔐 OAuth Flow: Response URL:', response.url);
      console.log('🔐 OAuth Flow: Response type:', response.type);
      console.log('🔐 OAuth Flow: Response redirected:', response.redirected);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔐 OAuth Flow: Error response body:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseText = await response.text();
      console.log('🔐 OAuth Flow: Raw response text:', responseText);
      
      let data;
      try {
        data = JSON.parse(responseText);
        console.log('🔐 OAuth Flow: Parsed JSON data:', data);
      } catch (parseError) {
        console.error('🔐 OAuth Flow: JSON parse error:', parseError);
        console.error('🔐 OAuth Flow: Response was not valid JSON');
        throw new Error('Server returned invalid JSON response');
      }

      if (data.auth_url) {
        console.log('🔐 OAuth Flow: Success! Redirecting to:', data.auth_url);
        window.location.href = data.auth_url;
      } else {
        throw new Error('No auth_url in response');
      }

    } catch (error) {
      console.error('🔐 OAuth Flow: Complete error details:', error);
      console.error('🔐 OAuth Flow: Error stack:', error.stack);
      
      let errorMessage = t('auth.oauthInitFailed');
      if (error.message.includes('Failed to fetch')) {
        errorMessage = t('auth.oauthNetworkError');
      } else if (error.message.includes('Unexpected token')) {
        errorMessage = t('auth.oauthInvalidResponse');
      } else if (error.message.includes('JSON')) {
        errorMessage = t('auth.oauthInvalidFormat');
      } else {
        errorMessage = `${t('auth.oauthErrorPrefix')}: ${error.message}`;
      }
      
      onError?.(errorMessage);
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <button
        onClick={handleGoogleLogin}
        disabled={isLoading || disabled}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <FcGoogle className="w-5 h-5" />
        {isLoading ? t('auth.connecting') : t('auth.continueWithGoogle')}
      </button>

      {!isLoading && disabled && disabledReason && (
        <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">{disabledReason}</p>
      )}
      
      <div className="mt-4 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('auth.newUsersChooseUsername')}
        </p>
      </div>
    </div>
  );
};

export default OAuthLogin;
