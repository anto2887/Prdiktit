import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useGroups } from '../../contexts/GroupContext';

const MatchAvailabilityCheck = ({ children }) => {
  const navigate = useNavigate();
  const { userGroups } = useGroups();
  
  if (!userGroups || userGroups.length === 0) {
    return (
      <div className="text-center py-8">
        <h3 className="text-xl font-semibold text-gray-700 mb-4">
          No Leagues Joined
        </h3>
        <p className="text-gray-600 mb-4">
          You need to join a league before you can make predictions.
        </p>
        <button
          onClick={() => navigate('/groups/join')}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Join a League
        </button>
      </div>
    );
  }

  return children;
};

export default MatchAvailabilityCheck;