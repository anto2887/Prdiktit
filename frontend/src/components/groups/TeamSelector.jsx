// TeamSelector.jsx - Fixed version
import React, { useState, useEffect, useCallback } from 'react';
import { useGroups, useNotifications } from '../../contexts/AppContext';
import LoadingSpinner from '../common/LoadingSpinner';

// Optimized team card component with improved image handling
const TeamCard = React.memo(({ team, isSelected, onToggle, index, imageLoadStates, handleImageLoad }) => (
  <div
    className={`relative flex items-center p-3 border rounded-lg cursor-pointer transition-colors group
      ${isSelected 
        ? 'border-blue-500 bg-blue-50' 
        : 'border-gray-200 hover:border-blue-300'}`}
    onClick={() => onToggle(team.id)}
    style={{ 
      animationDelay: `${index * 50}ms` 
    }}
    title={team.name}
  >
    <input
      type="checkbox"
      checked={isSelected}
      onChange={() => onToggle(team.id)}
      className="mr-3 flex-shrink-0"
    />
    <div className="w-8 h-8 mr-2 flex-shrink-0 flex items-center justify-center">
      {imageLoadStates[team.id] === 'loading' && (
        <div className="w-6 h-6 bg-gray-200 rounded animate-pulse"></div>
      )}
      {imageLoadStates[team.id] === 'error' && (
        <div className="w-6 h-6 bg-gray-200 rounded flex items-center justify-center">
          <span className="text-gray-500 text-xs">⚽</span>
        </div>
      )}
      {imageLoadStates[team.id] === 'loaded' && (
        <img
          src={team.logo}
          alt={`${team.name} logo`}
          className="w-6 h-6 object-contain"
          loading="lazy"
        />
      )}
    </div>
    <span className="font-medium text-gray-700 text-sm truncate">{team.name}</span>
    
    {/* Custom Tooltip */}
    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-10 pointer-events-none">
      {team.name}
      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
    </div>
  </div>
));

const TeamSelector = ({ selectedLeague, onTeamsSelected, selectedTeams = [] }) => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [imageLoadStates, setImageLoadStates] = useState({});
  
  const { fetchTeamsForLeague } = useGroups();
  const { showError } = useNotifications();

  useEffect(() => {
    process.env.NODE_ENV === 'development' && console.log('TeamSelector useEffect triggered:', { selectedLeague, teams: teams.length });
    
    if (selectedLeague) {
      process.env.NODE_ENV === 'development' && console.log('Loading teams for league:', selectedLeague);
      loadTeams();
    } else {
      process.env.NODE_ENV === 'development' && console.log('No league selected, clearing teams');
      setTeams([]);
      setImageLoadStates({});
    }
  }, [selectedLeague]);

  // Improved image loading with proper error handling
  const handleImageLoad = useCallback((teamId, success = true) => {
    setImageLoadStates(prev => ({
      ...prev,
      [teamId]: success ? 'loaded' : 'error'
    }));
  }, []);

  // Filter teams based on search
  const filteredTeams = searchTerm.trim() 
    ? teams.filter(team => team.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : teams;

  const loadTeams = async () => {
    if (!selectedLeague) return;
    
    setLoading(true);
    setError(null);
    
    try {
      process.env.NODE_ENV === 'development' && console.log(`Loading teams for league: ${selectedLeague}`);
      
      const response = await fetchTeamsForLeague(selectedLeague);
      
      if (response && response.status === 'success' && Array.isArray(response.data)) {
        process.env.NODE_ENV === 'development' && console.log(`Successfully loaded ${response.data.length} teams`);
        setTeams(response.data);
        
        // Initialize image load states for all teams
        const initialLoadStates = response.data.reduce((acc, team) => ({
          ...acc,
          [team.id]: 'loading'
        }), {});
        setImageLoadStates(initialLoadStates);
        
        // Preload images with proper error handling
        response.data.forEach(team => {
          if (team.logo) {
            const img = new Image();
            img.onload = () => handleImageLoad(team.id, true);
            img.onerror = () => handleImageLoad(team.id, false);
            img.src = team.logo;
          } else {
            // No logo available, mark as error
            handleImageLoad(team.id, false);
          }
        });
      } else {
        process.env.NODE_ENV === 'development' && console.error("Invalid teams data format:", response.data);
        setTeams([]);
        setError("No teams available. Please try again later.");
      }
    } catch (err) {
      process.env.NODE_ENV === 'development' && console.error('Error loading teams:', err);
      setError('Failed to load teams. Please try refreshing the page.');
      showError('Failed to load teams. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  };

  const handleTeamToggle = useCallback((teamId) => {
    const updatedSelection = selectedTeams.includes(teamId)
      ? selectedTeams.filter(id => id !== teamId)
      : [...selectedTeams, teamId];
    onTeamsSelected(updatedSelection);
  }, [selectedTeams, onTeamsSelected]);

  const handleSelectAll = () => {
    const allTeamIds = teams.map(team => team.id);
    const allSelected = allTeamIds.every(id => selectedTeams.includes(id));
    onTeamsSelected(allSelected ? [] : allTeamIds);
  };

  const handleClearSelection = () => {
    onTeamsSelected([]);
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

  if (!Array.isArray(teams) || teams.length === 0) {
    return (
      <div className="text-gray-500 py-4">
        No teams available for this league. Please try selecting a different league.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search teams..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={handleSelectAll}
            className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
          >
            {teams.every(team => selectedTeams.includes(team.id)) ? 'Deselect All' : 'Select All'}
          </button>
          {selectedTeams.length > 0 && (
            <button
              onClick={handleClearSelection}
              className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              Clear ({selectedTeams.length})
            </button>
          )}
        </div>
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {filteredTeams.map((team, index) => (
          <TeamCard
            key={team.id}
            team={team}
            isSelected={selectedTeams.includes(team.id)}
            onToggle={handleTeamToggle}
            index={index}
            imageLoadStates={imageLoadStates}
            handleImageLoad={handleImageLoad}
          />
        ))}
      </div>

      {/* Selection Summary */}
      {selectedTeams.length > 0 && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">
            {selectedTeams.length} team{selectedTeams.length !== 1 ? 's' : ''} selected
            {searchTerm && ` (filtered from ${teams.length} total teams)`}
          </p>
        </div>
      )}
    </div>
  );
};

export default TeamSelector;