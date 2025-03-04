// src/pages/CreateGroupPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';

// Components
import GroupForm from '../components/groups/GroupForm';

const CreateGroupPage = () => {
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Create New League</h1>
        <Link
          to="/groups"
          className="text-blue-600 hover:text-blue-800"
        >
          ← Back to Leagues
        </Link>
      </div>
      
      <GroupForm />
    </div>
  );
};

export default CreateGroupPage;