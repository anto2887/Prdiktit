import React from 'react';
import { Link } from 'react-router-dom';
import { useGroups } from '../../contexts/AppContext';
import { useI18n } from '../../i18n';

const ContextAwareNavigation = ({ groupId, currentPath }) => {
  const { userGroups, currentGroup } = useGroups();
  const { t } = useI18n();
  
  // Get the group data from either currentGroup or userGroups
  const group = currentGroup || userGroups.find(g => g.id === groupId);
  
  if (!group || !group.is_activated) {
    return null;
  }

  const navigationItems = [
    {
      path: `/groups/${groupId}`,
      label: t('groupDetails.standings'),
      icon: '🏆',
      description: t('contextNav.standingsDesc')
    },
    {
      path: `/groups/${groupId}/predictions`,
      label: t('nav.predictions'),
      icon: '📊',
      description: t('contextNav.predictionsDesc')
    },
    {
      path: `/groups/${groupId}/rivalries`,
      label: t('groupDetails.rivalries'),
      icon: '⚔️',
      description: t('contextNav.rivalriesDesc'),
      highlight: group.weeks_until_next_rivalry === 0
    },
    {
      path: `/groups/${groupId}/analytics`,
      label: t('groupActivation.analytics'),
      icon: '📈',
      description: t('contextNav.analyticsDesc')
    }
  ];

  return (
    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4 mb-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        🚀 {t('contextNav.activeTitle')}
      </h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {navigationItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`group relative p-4 bg-white rounded-lg border-2 transition-all duration-200 hover:shadow-md ${
              currentPath === item.path
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200 hover:border-purple-300'
            } ${item.highlight ? 'ring-2 ring-purple-400 ring-opacity-50' : ''}`}
          >
            <div className="text-center">
              <div className="text-2xl mb-2">{item.icon}</div>
              <h4 className="font-medium text-gray-800 group-hover:text-purple-700 transition-colors">
                {item.label}
              </h4>
              <p className="text-xs text-gray-600 mt-1 group-hover:text-purple-600 transition-colors">
                {item.description}
              </p>
              
              {item.highlight && (
                <div className="absolute -top-2 -right-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 animate-pulse">
                    🔥 {t('contextNav.hot')}
                  </span>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
      
      {group.weeks_until_next_rivalry === 0 && (
        <div className="mt-4 p-3 bg-purple-100 border border-purple-300 rounded-md">
          <p className="text-sm text-purple-800 font-medium text-center">
            ⚔️ {t('contextNav.rivalryWeekNotice')}
          </p>
        </div>
      )}
      
      <div className="mt-4 text-center">
        <p className="text-sm text-gray-600">
          {t('contextNav.footerNote')}
        </p>
      </div>
    </div>
  );
};

export default ContextAwareNavigation;
