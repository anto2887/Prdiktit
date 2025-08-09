import React from 'react';
import { useUser } from '../../contexts/AppContext';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';

const Profile = () => {
  const { profile, stats, loading, error } = useUser();

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="max-w-3xl mx-auto py-6">
      <div className="bg-white shadow rounded-lg">
        {/* Profile Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900">Profile</h2>
          </div>
        </div>

        {/* Profile Content */}
        <div className="px-6 py-4">
          <div className="space-y-6">
            {/* Profile Info */}
            <div>
              <h3 className="text-lg font-medium text-gray-900">Account Information</h3>
              <dl className="mt-2 divide-y divide-gray-200">
                <div className="py-3 flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">Username</dt>
                  <dd className="text-sm text-gray-900">{profile?.username}</dd>
                </div>
                <div className="py-3 flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">Member Since</dt>
                  <dd className="text-sm text-gray-900">
                    {new Date(profile?.created_at).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Stats Overview */}
            <div>
              <h3 className="text-lg font-medium text-gray-900">Prediction Statistics</h3>
              <dl className="mt-2 grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div className="px-4 py-5 bg-gray-50 shadow rounded-lg overflow-hidden sm:p-6">
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Points
                  </dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">
                    {stats?.total_points || 0}
                  </dd>
                </div>
                <div className="px-4 py-5 bg-gray-50 shadow rounded-lg overflow-hidden sm:p-6">
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Perfect Predictions
                  </dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">
                    {stats?.perfect_predictions || 0}
                  </dd>
                </div>
                <div className="px-4 py-5 bg-gray-50 shadow rounded-lg overflow-hidden sm:p-6">
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Average Points
                  </dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">
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