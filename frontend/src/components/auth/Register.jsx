import React from 'react';
import { Link } from 'react-router-dom';
import { FcGoogle } from 'react-icons/fc';
import OAuthLogin from './OAuthLogin';

export const Register = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <img 
          src="/static/images/logo.svg" 
          alt="Logo" 
          className="mx-auto h-12 w-auto"
        />
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Create your account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Join PrdiktIt using your Google account
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center mb-6">
            <p className="text-gray-600 mb-4">
              New users can only register using Google OAuth2 for enhanced security and convenience.
            </p>
          </div>

          <OAuthLogin 
            onSuccess={(data) => {
              if (data.access_token) {
                // Store the token and redirect
                localStorage.setItem('access_token', data.access_token);
                // Redirect to dashboard after successful registration
                window.location.href = '/dashboard';
              }
            }}
            onError={(error) => {
              console.error('OAuth registration error:', error);
            }}
          />

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link 
                to="/login" 
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Sign in here
              </Link>
            </p>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-sm font-medium text-blue-800 mb-2">Why Google OAuth2?</h3>
            <ul className="text-sm text-blue-700 space-y-1">
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