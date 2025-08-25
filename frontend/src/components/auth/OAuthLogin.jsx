import React, { useState } from 'react';
import { FcGoogle } from 'react-icons/fc';

const OAuthLogin = ({ onSuccess, onError }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/v1/oauth/google/login', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get OAuth URL');
      }

      const data = await response.json();
      window.location.href = data.auth_url;
      
    } catch (error) {
      console.error('OAuth login error:', error);
      onError?.(error.message || 'Failed to initiate OAuth login');
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <button
        onClick={handleGoogleLogin}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <FcGoogle className="w-5 h-5" />
        {isLoading ? 'Connecting...' : 'Continue with Google'}
      </button>
      
      <div className="mt-4 text-center">
        <p className="text-sm text-gray-600">
          New users will be able to choose their username after Google authentication
        </p>
      </div>
    </div>
  );
};

export default OAuthLogin;
