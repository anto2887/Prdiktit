import React from 'react';
import { NavLink } from 'react-router-dom';
import { useGroups } from '../../contexts/AppContext';
import { useI18n } from '../../i18n';

const Sidebar = () => {
  const { userGroups } = useGroups();
  const { t } = useI18n();

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 shadow-lg hidden md:block">
      <div className="h-full px-3 py-4 overflow-y-auto">
        <nav className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
              {t('nav.navigation')}
            </h3>
            <ul className="space-y-2">
              <li>
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) =>
                    `flex items-center p-2 rounded-lg ${
                      isActive
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`
                  }
                >
                  {t('nav.dashboard')}
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/predictions"
                  className={({ isActive }) =>
                    `flex items-center p-2 rounded-lg ${
                      isActive
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`
                  }
                >
                  {t('nav.predictions')}
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/wallet"
                  className={({ isActive }) =>
                    `flex items-center p-2 rounded-lg ${
                      isActive
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`
                  }
                >
                  {t('nav.wallet')}
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/powerups"
                  className={({ isActive }) =>
                    `flex items-center p-2 rounded-lg ${
                      isActive
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`
                  }
                >
                  {t('nav.powerups')}
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/worldcup/leaderboard"
                  className={({ isActive }) =>
                    `flex items-center p-2 rounded-lg ${
                      isActive
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`
                  }
                >
                  {t('nav.globalPot')}
                </NavLink>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
              {t('groups.yourGroups')}
            </h3>
            <ul className="space-y-2">
              {userGroups.map(group => (
                <li key={group.id}>
                  <NavLink
                    to={`/groups/${group.id}`}
                    className={({ isActive }) =>
                      `flex items-center p-2 rounded-lg ${
                        isActive
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300'
                          : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`
                    }
                  >
                    {group.name}
                  </NavLink>
                </li>
              ))}
              <li>
                <NavLink
                  to="/groups/create"
                  className="flex items-center p-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  + {t('groups.createGroup')}
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/groups/join"
                  className="flex items-center p-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  🔗 {t('groups.joinGroup')}
                </NavLink>
              </li>
            </ul>
          </div>
        </nav>
      </div>
    </aside>
    );
};

export default Sidebar;