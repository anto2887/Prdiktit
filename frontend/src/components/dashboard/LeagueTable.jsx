import React, { useState, useEffect } from 'react';
import SeasonManager from '../../utils/seasonManager';
import { useNotifications } from '../../contexts/AppContext';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';

const LeagueTable = ({ 
  group, 
  members, 
  selectedSeason = null,
  onSeasonChange,
  showError,
  className = "" 
}) => {
  const [availableSeasons, setAvailableSeasons] = useState([]);
  const [localSelectedSeason, setLocalSelectedSeason] = useState(selectedSeason);
  const { showError: showAppError } = useNotifications();

  // Get available seasons for the group's league
  useEffect(() => {
    if (group && group.league) {
      const seasons = SeasonManager.getAvailableSeasons(group.league, 5);
      setAvailableSeasons(seasons);
      
      // Set default season if none selected
      if (!localSelectedSeason && seasons.length > 0) {
        setLocalSelectedSeason(seasons[0].value);
      }
    }
  }, [group, localSelectedSeason]);

  // Update local state when prop changes
  useEffect(() => {
    if (selectedSeason !== localSelectedSeason) {
      setLocalSelectedSeason(selectedSeason);
    }
  }, [selectedSeason]);

  const handleSeasonChange = (event) => {
    const newSeason = event.target.value;
    setLocalSelectedSeason(newSeason);
    if (onSeasonChange) {
      onSeasonChange(newSeason);
    }
  };

  if (!group) return <ErrorMessage message="League not found" />;

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="w-full sm:w-auto">
          <select
            value={localSelectedSeason}
            onChange={handleSeasonChange}
            className="w-full p-2 border rounded"
          >
            {availableSeasons.map((season) => (
              <option key={season.value} value={season.value}>
                {season.label}
              </option>
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

export default LeagueTable;