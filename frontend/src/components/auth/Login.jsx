import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useNotifications } from '../../contexts';
import OAuthLogin from './OAuthLogin';

export const POST_LOGIN_REDIRECT_KEY = 'prdiktit_post_login_redirect';

export const Login = () => {
  const { showSuccess, showError } = useNotifications();
  const location = useLocation();

  // Preserve return URL across Google OAuth full-page redirect (callback reads this).
  useEffect(() => {
    const fromLoc = location.state?.from;
    if (fromLoc?.pathname && fromLoc.pathname !== '/login') {
      const target = `${fromLoc.pathname}${fromLoc.search || ''}${fromLoc.hash || ''}`;
      try {
        sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, target);
      } catch {
        /* ignore quota / private mode */
      }
    }
  }, [location.state?.from]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <img 
          src="/static/images/logo.svg" 
          alt="Logo" 
          className="mx-auto h-12 w-auto"
        />
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-gray-100">
          Sign in to PrdiktIt
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-400">
                Sign in to your PrdiktIt account using Google OAuth2
              </p>
            </div>

            <div>
                          <OAuthLogin 
              onSuccess={() => {
                // Full OAuth round-trip finishes on OAuthCallbackPage
                showSuccess('Successfully logged in with Google');
              }}
                onError={(error) => {
                  showError(error || 'OAuth login failed');
                }}
              />
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                New to PrdiktIt?{' '}
                <Link 
                  to="/register" 
                  className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300"
                >
                  Create your account
                </Link>
              </p>
              
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">For Existing Users</h3>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                  If you have an existing username/password account, please contact support to migrate to OAuth2.
                </p>
                <Link
                  to="/reset-password"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 underline"
                >
                  Forgot your password?
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;