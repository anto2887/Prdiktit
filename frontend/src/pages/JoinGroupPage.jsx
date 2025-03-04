// src/pages/JoinGroupPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';

// Components
import JoinGroup from '../components/groups/JoinGroup';

const JoinGroupPage = () => {
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Join a League</h1>
        <Link
          to="/groups"
          className="text-blue-600 hover:text-blue-800"
        >
          ← Back to Leagues
        </Link>
      </div>
      
      <JoinGroup />
    </div>
  );
};

export default JoinGroupPage;