// frontend/src/components/common/SeasonSelector.jsx
import React, { useState, useEffect } from 'react';
import SeasonManager from '../../utils/seasonManager';

const SeasonSelector = ({ 
  league, 
  selectedSeason, 
  onSeasonChange, 
  className = "",
  disabled = false,
  yearsBack = 5 
}) => {
  const [availableSeasons, setAvailableSeasons] = useState([]);

  useEffect(() => {
    if (league) {
      const seasons = SeasonManager.getAvailableSeasons(league, yearsBack);
      setAvailableSeasons(seasons);
      
      // Set default season if none selected
      if (!selectedSeason && seasons.length > 0) {
        onSeasonChange(seasons[0].value);
      }
    }
  }, [league, yearsBack, selectedSeason, onSeasonChange]);

  const handleSeasonChange = (event) => {
    const newSeason = event.target.value;
    onSeasonChange(newSeason);
  };

  if (!league || availableSeasons.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Season
      </label>
      <select
        value={selectedSeason || ''}
        onChange={handleSeasonChange}
        disabled={disabled}
        className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        {availableSeasons.map((season) => (
          <option key={season.value} value={season.value}>
            {season.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default SeasonSelector;