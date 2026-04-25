import React, { useState, useEffect } from 'react';

const UsernameSelection = ({ oauthData, onComplete, onCancel }) => {
  const [username, setUsername] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [isOver18, setIsOver18] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (username.length >= 3) {
      checkUsernameAvailability();
    } else {
      setIsAvailable(null);
    }
  }, [username]);

  const checkUsernameAvailability = async () => {
    if (username.length < 3) return;
    
    setIsChecking(true);
    try {
      // Use backend URL from environment variable for username availability check
      const response = await fetch(`${process.env.REACT_APP_API_URL}/oauth/check-username/${username}`);
      const data = await response.json();
      
      setIsAvailable(data.available);
      if (!data.available) {
        setError(data.reason);
      } else {
        setError('');
      }
    } catch (error) {
      console.error('Username check error:', error);
      setIsAvailable(false);
      setError('Failed to check username availability');
    } finally {
      setIsChecking(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || username.length < 3 || !isAvailable) return;

    setIsSubmitting(true);
    try {
      // Use backend URL from environment variable for user registration
      const response = await fetch(`${process.env.REACT_APP_API_URL}/oauth/google/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          email: oauthData.email,
          oauth_id: oauthData.oauth_id,
          oauth_provider: 'google',
          accepted_terms: acceptedTerms,
          accepted_privacy: acceptedPrivacy,
          is_over_18: isOver18
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to complete registration');
      }

      const data = await response.json();
      onComplete(data);
      
    } catch (error) {
      console.error('Registration error:', error);
      setError(error.message || 'Failed to complete registration');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getUsernameStatus = () => {
    if (username.length < 3) return 'Enter at least 3 characters';
    if (isChecking) return 'Checking availability...';
    if (isAvailable === null) return '';
    if (isAvailable) return 'Username is available!';
    return error || 'Username not available';
  };

  const getStatusColor = () => {
    if (username.length < 3) return 'text-gray-500 dark:text-gray-400';
    if (isChecking) return 'text-blue-500 dark:text-blue-400';
    if (isAvailable === null) return 'text-gray-500 dark:text-gray-400';
    if (isAvailable) return 'text-green-600 dark:text-green-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Choose Your Username</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Welcome! Please choose a username for your account.
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Email: {oauthData.email}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Username
          </label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter your username"
            minLength={3}
            maxLength={30}
            pattern="[a-zA-Z0-9_]+"
            title="Only letters, numbers, and underscores allowed"
            required
          />
          <p className={`text-sm mt-1 ${getStatusColor()}`}>
            {getUsernameStatus()}
          </p>
        </div>

        {error && (
          <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
            {error}
          </div>
        )}

        <div className="space-y-2 rounded-md bg-gray-50 dark:bg-gray-700 p-3">
          <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={isOver18}
              onChange={(e) => setIsOver18(e.target.checked)}
            />
            <span>I confirm I am at least 18 years old.</span>
          </label>
          <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
            />
            <span>
              I agree to the{' '}
              <a href="/terms" className="text-blue-600 dark:text-blue-400 hover:underline">
                Terms of Service
              </a>
              .
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={acceptedPrivacy}
              onChange={(e) => setAcceptedPrivacy(e.target.checked)}
            />
            <span>
              I agree to the{' '}
              <a href="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline">
                Privacy Policy
              </a>
              .
            </span>
          </label>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={
              !username ||
              username.length < 3 ||
              !isAvailable ||
              isSubmitting ||
              !isOver18 ||
              !acceptedTerms ||
              !acceptedPrivacy
            }
            className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating Account...' : 'Create Account'}
          </button>
        </div>
      </form>

      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 text-center">
        <p>Username requirements:</p>
        <ul className="mt-1 space-y-1">
          <li>• 3-30 characters long</li>
          <li>• Only letters, numbers, and underscores</li>
          <li>• Must be unique</li>
          <li>• Cannot be changed after creation</li>
        </ul>
      </div>
    </div>
  );
};

export default UsernameSelection;
