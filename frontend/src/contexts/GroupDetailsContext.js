// src/contexts/GroupDetailsContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useGroups } from './GroupContext';
import { useLeagueContext } from './LeagueContext';

// Create a new context specifically for group details
const GroupDetailsContext = createContext(null);

// This provider will wrap the LeagueTable component in GroupDetailsPage
export const GroupDetailsProvider = ({ groupId, children }) => {
  const { 
    fetchGroupMembers, 
    currentGroup, 
    fetchGroupDetails 
  } = useGroups();
  
  const {
    selectedSeason,
    selectedWeek,
    setSelectedSeason,
    setSelectedWeek
  } = useLeagueContext();
  
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch members data
  useEffect(() => {
    const loadData = async () => {
      if (!groupId) return;
      
      setLoading(true);
      try {
        // Make sure we have current group data
        await fetchGroupDetails(parseInt(groupId));
        
        // Get the members
        const membersData = await fetchGroupMembers(parseInt(groupId));
        if (Array.isArray(membersData)) {
          setMembers(membersData);
        } else {
          setMembers([]);
        }
      } catch (err) {
        console.error('Error loading group data:', err);
        setError('Failed to load league data. Please try refreshing the page.');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [groupId, fetchGroupDetails, fetchGroupMembers, selectedSeason, selectedWeek]);

  // Create the context value with all the data needed by child components
  const contextValue = {
    selectedSeason,
    selectedWeek,
    setSelectedSeason,
    setSelectedWeek,
    members,
    loading,
    error,
    group: currentGroup
  };

  return (
    <GroupDetailsContext.Provider value={contextValue}>
      {children}
    </GroupDetailsContext.Provider>
  );
};

// Custom hook to use this context
export const useGroupDetails = () => {
  const context = useContext(GroupDetailsContext);
  if (!context) {
    throw new Error('useGroupDetails must be used within a GroupDetailsProvider');
  }
  return context;
};

export default GroupDetailsContext;