// src/components/dashboard/LeagueTableContainer.jsx
import React from 'react';
import { useGroupDetails } from '../../contexts/GroupDetailsContext';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';

// This component uses the new GroupDetailsContext
const LeagueTableContainer = () => {
  const {
    group,
    members,
    loading,
    error,
    selectedSeason,
    selectedWeek,
    setSelectedSeason,
    setSelectedWeek
  } = useGroupDetails();

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!group) return <ErrorMessage message="League not found" />;

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="w-full sm:w-auto">
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="2024-2025">2024-2025</option>
            <option value="2023-2024">2023-2024</option>
          </select>
        </div>
        
        <div className="w-full sm:w-auto">
          <select
            value={selectedWeek || ''}
            onChange={(e) => setSelectedWeek(e.target.value ? parseInt(e.target.value) : null)}
            className="w-full p-2 border rounded"
          >
            <option value="">All Weeks</option>
            {Array.from({ length: 38 }, (_, i) => i + 1).map(week => (
              <option key={week} value={week}>Week {week}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-3 px-4 text-left">Rank</th>
              <th className="py-3 px-4 text-left">User</th>
              <th className="py-3 px-4 text-center">Points</th>
              <th className="py-3 px-4 text-center">Predictions</th>
              <th className="py-3 px-4 text-center">Perfect</th>
              <th className="py-3 px-4 text-center">Avg. Points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {members && members.length > 0 ? (
              members.map((member, index) => (
                <tr key={member.user_id} className={index === 0 ? 'bg-yellow-50' : ''}>
                  <td className="py-3 px-4">
                    {index + 1}
                    {index === 0 && <span className="ml-2 text-yellow-500">👑</span>}
                  </td>
                  <td className="py-3 px-4 font-medium">{member.username}</td>
                  <td className="py-3 px-4 text-center font-bold">
                    {member.stats?.total_points || 0}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {member.stats?.total_predictions || 0}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {member.stats?.perfect_predictions || 0}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {(member.stats?.average_points || 0).toFixed(1)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="py-6 text-center text-gray-500">
                  No data available for this league yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LeagueTableContainer;