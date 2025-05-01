// TeamSelector.jsx - Fixed version
import React, { useState, useEffect } from 'react';
import { useGroups } from '../../contexts/GroupContext';
import LoadingSpinner from '../common/LoadingSpinner';

const TeamSelector = ({ selectedLeague, onTeamsSelected, selectedTeams = [] }) => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { fetchTeamsForLeague } = useGroups();

  useEffect(() => {
    if (selectedLeague) {
      loadTeams();
    }
  }, [selectedLeague]);

  const loadTeams = async () => {
    setLoading(true);
    setError(null);
    try {
      // Call the API function
      const response = await fetchTeamsForLeague(selectedLeague);
      
      // Check if response is successful
      if (response && response.status === 'success' && response.data) {
        setTeams(response.data);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      setError('Failed to load teams');
      console.error('Error loading teams:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTeamToggle = (teamId) => {
    const updatedSelection = selectedTeams.includes(teamId)
      ? selectedTeams.filter(id => id !== teamId)
      : [...selectedTeams, teamId];
    onTeamsSelected(updatedSelection);
  };

  if (loading) {
    return <div className="text-center py-4"><LoadingSpinner size="small" /></div>;
  }

  if (error) {
    return <div className="text-red-500 py-4">{error}</div>;
  }

  // Check if teams is an array before rendering
  if (!Array.isArray(teams) || teams.length === 0) {
    return <div className="text-gray-500 py-4">No teams available for this league.</div>;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {teams.map(team => (
        <div
          key={team.id}
          className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors
            ${selectedTeams.includes(team.id) 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-200 hover:border-blue-300'}`}
          onClick={() => handleTeamToggle(team.id)}
        >
          <input
            type="checkbox"
            checked={selectedTeams.includes(team.id)}
            onChange={() => handleTeamToggle(team.id)}
            className="mr-3"
          />
          <img
            src={team.logo || '/placeholder-team-logo.svg'}
            alt={`${team.name} logo`}
            className="w-8 h-8 object-contain mr-2"
            onError={(e) => { e.target.src = '/placeholder-team-logo.svg'; }}
          />
          <span className="font-medium text-gray-700">{team.name}</span>
        </div>
      ))}
    </div>
  );
};

export default TeamSelector;