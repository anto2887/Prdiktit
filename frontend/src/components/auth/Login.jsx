import React, { useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, useNotifications } from '../../contexts';
import LoadingSpinner from '../common/LoadingSpinner';
import OAuthLogin from './OAuthLogin';

export const Login = () => {
  const { isAuthenticated } = useAuth();
  const { showSuccess, showError } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/dashboard';

  useEffect(() => {
    if (isAuthenticated) {
      console.log('Login: User is authenticated, redirecting to:', from);
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  if (isAuthenticated) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <img 
          src="/static/images/logo.svg" 
          alt="Logo" 
          className="mx-auto h-12 w-auto"
        />
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Sign in to PrdiktIt
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-gray-600">
                Sign in to your PrdiktIt account using Google OAuth2
              </p>
            </div>

            <div>
                          <OAuthLogin 
              onSuccess={(data) => {
                // OAuth success is handled by OAuthCallbackPage
                // No need to store JWT tokens - using session-based auth
                showSuccess('Successfully logged in with Google');
                navigate(from, { replace: true });
              }}
                onError={(error) => {
                  showError(error || 'OAuth login failed');
                }}
              />
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-600 mb-4">
                New to PrdiktIt?{' '}
                <Link 
                  to="/register" 
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  Create your account
                </Link>
              </p>
              
              <div className="p-4 bg-blue-50 rounded-lg">
                <h3 className="text-sm font-medium text-blue-800 mb-2">For Existing Users</h3>
                <p className="text-sm text-blue-700 mb-3">
                  If you have an existing username/password account, please contact support to migrate to OAuth2.
                </p>
                <Link
                  to="/reset-password"
                  className="text-sm text-blue-600 hover:text-blue-500 underline"
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