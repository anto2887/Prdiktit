import React, { useState, useEffect } from 'react';

const UsernameSelection = ({ oauthData, onComplete, onCancel }) => {
  const [username, setUsername] = useState('');
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
      const response = await fetch(`/api/v1/oauth/check-username/${username}`);
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
      const response = await fetch('/api/v1/oauth/google/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          email: oauthData.email,
          oauth_id: oauthData.sub,
          oauth_provider: 'google'
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
    if (username.length < 3) return 'text-gray-500';
    if (isChecking) return 'text-blue-500';
    if (isAvailable === null) return 'text-gray-500';
    if (isAvailable) return 'text-green-600';
    return 'text-red-600';
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose Your Username</h2>
        <p className="text-gray-600">
          Welcome! Please choose a username for your account.
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Email: {oauthData.email}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
            Username
          </label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!username || username.length < 3 || !isAvailable || isSubmitting}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating Account...' : 'Create Account'}
          </button>
        </div>
      </form>

      <div className="mt-4 text-xs text-gray-500 text-center">
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
