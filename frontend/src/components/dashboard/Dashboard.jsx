// src/components/dashboard/Dashboard.jsx
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  useUser, 
  usePredictions, 
  useGroups, 
  useLeagueContext 
} from '../../contexts/AppContext';
import DashboardStats from './DashboardStats';
import RecentPredictions from './RecentPredictions';
import LeagueTable from './LeagueTable';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';

const Dashboard = () => {
  const { profile, stats, loading: userLoading, error: userError } = useUser();
  const { loading: predictionsLoading, error: predictionsError } = usePredictions();
  const { userGroups, fetchUserGroups, loading: groupsLoading, error: groupsError } = useGroups();
  const { selectedGroup, selectedSeason, selectedWeek, setSelectedGroup, setSelectedSeason, setSelectedWeek } = useLeagueContext();

  const isLoading = userLoading || predictionsLoading;
  const error = userError || predictionsError;

  // FIXED: Ensure groups are fetched when component mounts
  useEffect(() => {
    if (!userGroups || userGroups.length === 0) {
      console.log('Dashboard: Fetching user groups...');
      fetchUserGroups();
    }
  }, [fetchUserGroups, userGroups]);

  // Add this after the existing useEffect hooks (around line 30)
  useEffect(() => {
    console.log('=== DASHBOARD DEBUG ===');
    console.log('Profile:', profile);
    console.log('Profile loaded:', !!profile);
    console.log('Profile ID:', profile?.id);
    console.log('Username:', profile?.username);
    console.log('Groups:', userGroups);
    console.log('Groups loaded:', userGroups?.length || 0);
    console.log('Groups loading:', groupsLoading);
    console.log('Groups error:', groupsError);
    console.log('Selected group:', selectedGroup?.name || 'None');
    
    const dataFetchStatus = {
      profile: !!profile,
      predictions: true,
      groups: !!userGroups && userGroups.length > 0,
      matches: true,
      fixtures: true
    };
    console.log('Data fetch status:', dataFetchStatus);
  }, [profile, userGroups, groupsLoading, groupsError, selectedGroup]);

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
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
              <Link
                to="/groups/join"
                className="inline-flex items-center justify-center px-4 py-2 border border-blue-600 rounded-md shadow-sm text-sm font-medium text-blue-600 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Join League
              </Link>
              <Link
                to="/groups/create"
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Create League
              </Link>
            </div>
          </div>

          {/* FIXED: Better group display logic */}
          {!userGroups || userGroups.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                You're not in any leagues yet
              </h3>
              <p className="text-gray-500 mb-6">
                Join a league to start making predictions and competing with friends
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link
                  to="/groups/join"
                  className="inline-flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Enter League Code →
                </Link>
                <Link
                  to="/groups/create"
                  className="inline-flex items-center px-6 py-3 border border-blue-600 rounded-md shadow-sm text-base font-medium text-blue-600 bg-white hover:bg-blue-50"
                >
                  Create Your Own League
                </Link>
              </div>
            </div>
          ) : (
            <div>
              {/* FIXED: League Filters */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0 mb-6">
                <h3 className="text-lg font-medium text-gray-900">League Table</h3>
                <LeagueFilters />
              </div>
              
              {/* Display groups as cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {userGroups.map(group => (
                  <div key={group.id} className="bg-white border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-lg font-medium text-gray-900">{group.name}</h4>
                        {group.role === 'ADMIN' && (
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{group.league}</p>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">
                          {group.member_count || 1} members
                        </span>
                        <Link
                          to={`/groups/${group.id}`}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          View League →
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

// FIXED: Separate component for league filters
const LeagueFilters = () => {
  const { userGroups } = useGroups();
  const { selectedGroup, selectedSeason, selectedWeek, 
          setSelectedGroup, setSelectedSeason, setSelectedWeek } = useLeagueContext();

  // FIXED: Set default selected group if none is selected
  React.useEffect(() => {
    if (userGroups && userGroups.length > 0 && !selectedGroup) {
      setSelectedGroup(userGroups[0]);
    }
  }, [userGroups, selectedGroup, setSelectedGroup]);

  if (!userGroups || userGroups.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* League Selector */}
      <select
        className="block w-48 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
        value={selectedGroup?.id || ''}
        onChange={(e) => {
          const groupId = parseInt(e.target.value);
          const group = userGroups.find(g => g.id === groupId);
          setSelectedGroup(group);
        }}
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
        value={selectedSeason || '2024-2025'}
        onChange={(e) => setSelectedSeason(e.target.value)}
      >
        <option value="2024-2025">2024-2025</option>
        <option value="2023-2024">2023-2024</option>
        <option value="2022-2023">2022-2023</option>
      </select>

      {/* Week Selector */}
      <select
        className="block w-32 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
        value={selectedWeek || ''}
        onChange={(e) => setSelectedWeek(e.target.value ? parseInt(e.target.value) : null)}
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