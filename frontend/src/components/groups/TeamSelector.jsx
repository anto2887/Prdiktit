// TeamSelector.jsx
import React, { useState, useEffect } from 'react';
import { useGroups } from '../../contexts/GroupContext';

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
      const response = await fetchTeamsForLeague(selectedLeague);
      if (response.status === 'success') {
        setTeams(response.data);
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
    return <div className="text-center py-4">Loading teams...</div>;
  }

  if (error) {
    return <div className="text-red-500 py-4">{error}</div>;
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
            src={team.logo}
            alt={`${team.name} logo`}
            className="w-8 h-8 object-contain mr-2"
          />
          <span className="font-medium text-gray-700">{team.name}</span>
        </div>
      ))}
    </div>
  );
};

export default TeamSelector;