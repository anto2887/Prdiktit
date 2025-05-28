// TeamSelector.jsx - Fixed version
import React, { useState, useEffect } from 'react';
import { useGroups, useNotifications } from '../../contexts/AppContext';
import LoadingSpinner from '../common/LoadingSpinner';

const TeamSelector = ({ selectedLeague, onTeamsSelected, selectedTeams = [] }) => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { fetchTeamsForLeague } = useGroups();
  const { showError } = useNotifications();

  useEffect(() => {
    if (selectedLeague) {
      loadTeams();
    } else {
      // Clear teams if no league is selected
      setTeams([]);
    }
  }, [selectedLeague]);

  const loadTeams = async () => {
    if (!selectedLeague) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Loading teams for league: ${selectedLeague}`);
      
      // Call the API function
      const response = await fetchTeamsForLeague(selectedLeague);
      
      // Check if response is successful
      if (response && response.status === 'success') {
        if (Array.isArray(response.data)) {
          console.log(`Successfully loaded ${response.data.length} teams`);
          setTeams(response.data);
        } else {
          console.error("Invalid teams data format:", response.data);
          setTeams([]);
          setError("No teams available. Please try again later.");
        }
      } else {
        throw new Error(response?.message || "Failed to load teams");
      }
    } catch (err) {
      console.error('Error loading teams:', err);
      setError('Failed to load teams. Please try refreshing the page.');
      showError('Failed to load teams. Please try refreshing the page.');
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
    return (
      <div className="text-red-500 py-4">
        {error}
        <button
          onClick={loadTeams}
          className="ml-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Check if teams is an array before rendering
  if (!Array.isArray(teams) || teams.length === 0) {
    return (
      <div className="text-gray-500 py-4">
        No teams available for this league. Please try selecting a different league.
      </div>
    );
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