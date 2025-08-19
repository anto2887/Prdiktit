import React from 'react';
import { Link } from 'react-router-dom';
import { useGroupActivation } from '../../contexts/AppContext';

const ContextAwareNavigation = ({ groupId, currentPath }) => {
  const { groupActivation } = useGroupActivation();

  if (!groupActivation || !groupActivation.isActive) {
    return null;
  }

  const navigationItems = [
    {
      path: `/groups/${groupId}`,
      label: 'Standings',
      icon: '🏆',
      description: 'View group leaderboard and standings'
    },
    {
      path: `/groups/${groupId}/predictions`,
      label: 'Predictions',
      icon: '📊',
      description: 'View all group predictions and results'
    },
    {
      path: `/groups/${groupId}/rivalries`,
      label: 'Rivalries',
      icon: '⚔️',
      description: 'Weekly rivalry challenges and competitions',
      highlight: groupActivation.weeksUntilNextRivalry === 0
    },
    {
      path: `/analytics`,
      label: 'Analytics',
      icon: '📈',
      description: 'Advanced performance insights and statistics'
    }
  ];

  return (
    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4 mb-6">
      <h3 className="text-lg font-semibold text-purple-800 mb-3">
        🚀 Available Features
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {navigationItems.map((item) => {
          const isActive = currentPath === item.path;
          const isHighlighted = item.highlight;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`
                block p-3 rounded-lg border transition-all duration-200 hover:shadow-md
                ${isActive 
                  ? 'bg-purple-100 border-purple-300 text-purple-800' 
                  : 'bg-white border-purple-200 text-purple-700 hover:border-purple-300'
                }
                ${isHighlighted ? 'ring-2 ring-orange-300 ring-opacity-50' : ''}
              `}
            >
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-xl">{item.icon}</span>
                <span className={`font-medium ${isHighlighted ? 'text-orange-700' : ''}`}>
                  {item.label}
                </span>
                {isHighlighted && (
                  <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
                    Active Now!
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600">{item.description}</p>
            </Link>
          );
        })}
      </div>
      
      {groupActivation.weeksUntilNextRivalry === 0 && (
        <div className="mt-4 bg-orange-100 border border-orange-300 rounded-md p-3">
          <p className="text-sm text-orange-800 font-medium">
            ⚔️ Rivalry Week is Active! Challenge your group members now!
          </p>
        </div>
      )}
    </div>
  );
};

export default ContextAwareNavigation;
