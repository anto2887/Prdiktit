import React from 'react';
import { NavLink } from 'react-router-dom';
import { useGroups } from '../../contexts/AppContext';

const Sidebar = () => {
  const { userGroups } = useGroups();

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 shadow-lg hidden md:block">
      <div className="h-full px-3 py-4 overflow-y-auto">
        <nav className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
              Navigation
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
                  Dashboard
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
                  Predictions
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
                  Wallet
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
                  Power-ups
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
                  Global Pot
                </NavLink>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
              Your Groups
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
                  + Create Group
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/groups/join"
                  className="flex items-center p-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  🔗 Join Group
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