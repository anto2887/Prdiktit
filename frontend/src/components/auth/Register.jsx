import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import OAuthLogin from './OAuthLogin';

export const Register = () => {
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <img 
          src="/static/images/logo.svg" 
          alt="Logo" 
          className="mx-auto h-12 w-auto"
        />
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-gray-100">
          Create your account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          Join PrdiktIt using your Google account
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center mb-6">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              New users can only register using Google OAuth2 for enhanced security and convenience.
            </p>
          </div>

          <OAuthLogin 
            disabled={!acceptedTerms}
            disabledReason="Please accept the Terms and Privacy Policy to continue."
            onSuccess={(data) => {
              // OAuth success is handled by OAuthCallbackPage
              // No need to store JWT tokens - using session-based auth
              // Redirect to dashboard after successful registration
              window.location.href = '/dashboard';
            }}
            onError={(error) => {
              console.error('OAuth registration error:', error);
            }}
          />

          <div className="mt-5">
            <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
              />
              <span>
                I am at least 18 years old and I agree to the{' '}
                <Link to="/terms" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Already have an account?{' '}
              <Link 
                to="/login" 
                className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300"
              >
                Sign in here
              </Link>
            </p>
          </div>

          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">Why Google OAuth2?</h3>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>• Enhanced security with Google's authentication</li>
              <li>• No need to remember another password</li>
              <li>• Quick one-click registration</li>
              <li>• Choose your own custom username</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;