import React from 'react';
import { useUser } from '../../contexts/AppContext';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';

const Profile = () => {
  const { profile, stats, loading, error } = useUser();

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  const initial = profile?.username?.charAt(0).toUpperCase() || 'U';

  return (
    <div className="max-w-3xl mx-auto py-6">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        {/* Profile Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex flex-col items-center md:flex-row md:items-center md:space-x-4 text-center md:text-left">
              <div className="h-14 w-14 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xl font-semibold text-blue-600 dark:text-blue-300">
                {initial}
              </div>
              <div className="mt-2 md:mt-0">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {profile?.username}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Member since{' '}
                  {profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString()
                    : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Content */}
        <div className="px-6 py-4">
          <div className="space-y-6">
            {/* Account Info */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Account Information</h3>
              <dl className="mt-2 divide-y divide-gray-200 dark:divide-gray-700">
                <div className="py-3 flex flex-col sm:flex-row sm:justify-between sm:items-center">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Username</dt>
                  <dd className="text-sm text-gray-900 dark:text-gray-100 mt-1 sm:mt-0">{profile?.username}</dd>
                </div>
                <div className="py-3 flex flex-col sm:flex-row sm:justify-between sm:items-center">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Member Since</dt>
                  <dd className="text-sm text-gray-900 dark:text-gray-100 mt-1 sm:mt-0">
                    {profile?.created_at
                      ? new Date(profile.created_at).toLocaleDateString()
                      : '—'}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Stats Overview */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Prediction Statistics</h3>
              <dl className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="px-4 py-5 bg-gray-50 dark:bg-gray-700 shadow rounded-lg overflow-hidden">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Total Points
                  </dt>
                  <dd className="mt-1 text-2xl md:text-3xl font-semibold text-gray-900 dark:text-gray-100">
                    {stats?.total_points || 0}
                  </dd>
                </div>
                <div className="px-4 py-5 bg-gray-50 dark:bg-gray-700 shadow rounded-lg overflow-hidden">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Perfect Predictions
                  </dt>
                  <dd className="mt-1 text-2xl md:text-3xl font-semibold text-gray-900 dark:text-gray-100">
                    {stats?.perfect_predictions || 0}
                  </dd>
                </div>
                <div className="px-4 py-5 bg-gray-50 dark:bg-gray-700 shadow rounded-lg overflow-hidden">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Total Predictions
                  </dt>
                  <dd className="mt-1 text-2xl md:text-3xl font-semibold text-gray-900 dark:text-gray-100">
                    {stats?.total_predictions || 0}
                  </dd>
                </div>
                <div className="px-4 py-5 bg-gray-50 dark:bg-gray-700 shadow rounded-lg overflow-hidden">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Average Points
                  </dt>
                  <dd className="mt-1 text-2xl md:text-3xl font-semibold text-gray-900 dark:text-gray-100">
                    {stats?.average_points?.toFixed(1) || '0.0'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;