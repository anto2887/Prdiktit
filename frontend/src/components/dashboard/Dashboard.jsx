// src/components/dashboard/Dashboard.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { usePredictions } from '../../contexts/PredictionContext';
import { useGroups } from '../../contexts/GroupContext';
import DashboardStats from './DashboardStats';
import RecentPredictions from './RecentPredictions';
import LeagueTable from './LeagueTable';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';

const Dashboard = () => {
  const { profile, stats, loading: userLoading, error: userError } = useUser();
  const { loading: predictionsLoading, error: predictionsError } = usePredictions();
  const { userGroups } = useGroups();

  const isLoading = userLoading || predictionsLoading;
  const error = userError || predictionsError;

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {profile?.username}!
          </h1>
          <Link
            to="/predictions/new"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Post Your Prediction →
          </Link>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stats Section */}
        <section className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Your Stats</h2>
          </div>
          <div className="p-6">
            <DashboardStats stats={stats} />
          </div>
        </section>

        {/* Recent Predictions Section */}
        <section className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Recent Predictions</h2>
          </div>
          <div className="p-6">
            <RecentPredictions />
          </div>
        </section>
      </div>

      {/* League Table Section - Full Width */}
      <section className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">My Leagues</h2>
            <div className="space-x-4">
              <Link
                to="/groups/join"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Join League
              </Link>
              <Link
                to="/groups/create"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Create League
              </Link>
            </div>
          </div>

          {userGroups.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                You're not in any leagues yet
              </h3>
              <p className="text-gray-500 mb-4">
                Join a league to start making predictions
              </p>
              <Link
                to="/groups/join"
                className="text-blue-600 hover:text-blue-800"
              >
                Enter League Code →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0">
              <h2 className="text-lg font-medium text-gray-900">League Table</h2>
              <LeagueFilters />
            </div>
          )}
        </div>
        {userGroups.length > 0 && (
          <div className="p-6">
            <LeagueTable />
          </div>
        )}
      </section>
    </div>
  );
};

// Separate component for league filters
const LeagueFilters = () => {
  const { userGroups } = useGroups();
  const { selectedGroup, selectedSeason, selectedWeek, 
          setSelectedGroup, setSelectedSeason, setSelectedWeek } = useLeagueContext();

  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* League Selector */}
      <select
        className="block w-48 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
        value={selectedGroup?.id || ''}
        onChange={(e) => setSelectedGroup(userGroups.find(g => g.id === e.target.value))}
      >
        {userGroups.map(group => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </select>

      {/* Season Selector */}
      <select
        className="block w-36 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
        value={selectedSeason || ''}
        onChange={(e) => setSelectedSeason(e.target.value)}
      >
        {['2023-2024', '2022-2023', '2021-2022'].map(season => (
          <option key={season} value={season}>{season}</option>
        ))}
      </select>

      {/* Week Selector */}
      <select
        className="block w-32 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
        value={selectedWeek || ''}
        onChange={(e) => setSelectedWeek(e.target.value)}
      >
        <option value="">All Weeks</option>
        {Array.from({ length: 38 }, (_, i) => (
          <option key={i + 1} value={i + 1}>Week {i + 1}</option>
        ))}
      </select>
    </div>
  );
};

export default Dashboard;