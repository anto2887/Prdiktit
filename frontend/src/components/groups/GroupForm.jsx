// GroupForm.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGroups, useNotifications } from '../../contexts/AppContext';
import TeamSelector from './TeamSelector';
import LoadingSpinner from '../common/LoadingSpinner';

const GroupForm = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    league: '',
    tracked_teams: []
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { createGroup } = useGroups();
  const { showSuccess, showError } = useNotifications();

  const leagues = [
    { id: 'Premier League', name: 'Premier League', season: '2024-25' },
    { id: 'La Liga', name: 'La Liga', season: '2024-25' },
    { id: 'UEFA Champions League', name: 'Champions League', season: '2024-25' },
    { id: 'MLS', name: 'MLS', season: '2025' },
    { id: 'FIFA Club World Cup', name: 'FIFA Club World Cup', season: '2025' }
  ];

  const handleLeagueSelect = (leagueId) => {
    setFormData(prev => ({
      ...prev,
      league: leagueId,
      tracked_teams: [] // Reset teams when league changes
    }));
    setStep(2);
  };

  const handleTeamsSelected = (teams) => {
    setFormData(prev => ({
      ...prev,
      tracked_teams: teams
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.league || formData.tracked_teams.length === 0) {
      showError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      console.log('Creating group with data:', formData);
      const response = await createGroup(formData);
      console.log('Create group response:', response);
      
      if (response && response.status === 'success') {
        showSuccess('League created successfully');
        
        // Navigate to the group details page with invite code
        if (response.data && response.data.group_id) {
          navigate(`/groups/${response.data.group_id}`, { 
            state: { 
              newGroup: true,
              inviteCode: response.data.invite_code,
              groupName: response.data.name
            } 
          });
        } else {
          // Fallback to groups list if missing data
          navigate('/groups');
        }
      } else {
        throw new Error(response?.message || 'Failed to create league');
      }
    } catch (error) {
      showError(error.message || 'Failed to create league');
      console.error('Error creating league:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Create League</h1>
        
        {/* Step 1: League Name */}
        <div className={`mb-6 ${step !== 1 && 'hidden'}`}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            League Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter league name"
            required
          />
          <button
            onClick={() => formData.name && setStep(2)}
            className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
            disabled={!formData.name}
          >
            Next
          </button>
        </div>

        {/* Step 2: League Selection */}
        <div className={`mb-6 ${step !== 2 && 'hidden'}`}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select League
          </label>
          <div className="grid grid-cols-2 gap-4">
            {leagues.map(league => (
              <button
                key={league.id}
                onClick={() => handleLeagueSelect(league.id)}
                className={`p-4 border rounded-lg transition-colors flex flex-col items-center justify-center
                  ${formData.league === league.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-blue-300'}`}
              >
                <span className="font-medium">{league.name}</span>
                <span className="text-sm text-gray-600 mt-1">Season {league.season}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Step 3: Team Selection */}
        <div className={`mb-6 ${step !== 2 || !formData.league ? 'hidden' : ''}`}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Teams to Track
          </label>
          <TeamSelector
            selectedLeague={formData.league}
            onTeamsSelected={handleTeamsSelected}
            selectedTeams={formData.tracked_teams}
          />
          
          <button
            onClick={handleSubmit}
            disabled={!formData.name || !formData.league || formData.tracked_teams.length === 0}
            className="mt-6 w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 
                     disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Create League
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupForm;