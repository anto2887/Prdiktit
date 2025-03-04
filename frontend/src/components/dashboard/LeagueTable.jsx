import React, { useState, useEffect } from 'react';
import { useGroups } from '../../contexts/GroupContext';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';

const LeagueTable = () => {
  const { userGroups, fetchGroupDetails, loading, error } = useGroups();
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [leagueData, setLeagueData] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState('2023-2024');
  const [selectedWeek, setSelectedWeek] = useState(null);

  useEffect(() => {
    if (userGroups.length > 0 && !selectedGroup) {
      setSelectedGroup(userGroups[0]);
    }
  }, [userGroups]);

  useEffect(() => {
    if (selectedGroup) {
      loadGroupData();
    }
  }, [selectedGroup, selectedSeason, selectedWeek]);

  const loadGroupData = async () => {
    try {
      // Add filter parameters based on selections
      const params = {};
      if (selectedSeason) params.season = selectedSeason;
      if (selectedWeek) params.week = selectedWeek;
      
      const groupDetails = await fetchGroupDetails(selectedGroup.id, params);
      
      if (groupDetails && groupDetails.members) {
        // Sort members by points (highest first)
        const sortedMembers = [...groupDetails.members]
          .sort((a, b) => (b.stats?.total_points || 0) - (a.stats?.total_points || 0));
        
        setLeagueData(sortedMembers);
      }
    } catch (err) {
      console.error('Error loading league data', err);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (userGroups.length === 0) return null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="w-full sm:w-auto">
          <select
            value={selectedGroup ? selectedGroup.id : ''}
            onChange={(e) => {
              const groupId = e.target.value;
              const group = userGroups.find(g => g.id === parseInt(groupId));
              setSelectedGroup(group || null);
            }}
            className="w-full p-2 border rounded"
          >
            {userGroups.map(group => (
              <option key={group.id} value={group.id}>
                {group.name} ({group.league})
              </option>
            ))}
          </select>
        </div>
        
        <div className="w-full sm:w-auto">
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="2023-2024">2023-2024</option>
            <option value="2022-2023">2022-2023</option>
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
            {leagueData.map((member, index) => (
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
            ))}
            
            {leagueData.length === 0 && (
              <tr>
                <td colSpan="6" className="py-6 text-center text-gray-500">
                  No data available for this timeframe
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