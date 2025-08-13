import React from 'react';
import { NavLink } from 'react-router-dom';
import { useGroups } from '../../contexts/AppContext';

const Sidebar = () => {
  const { userGroups } = useGroups();

  return (
    <aside className="w-64 bg-white shadow-lg">
      <div className="h-full px-3 py-4 overflow-y-auto">
        <nav className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-500">
              Navigation
            </h3>
            <ul className="space-y-2">
              <li>
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) =>
                    `flex items-center p-2 rounded-lg ${
                      isActive
                        ? 'bg-blue-100 text-blue-600'
                        : 'text-gray-700 hover:bg-gray-100'
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
                        ? 'bg-blue-100 text-blue-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`
                  }
                >
                  Predictions
                </NavLink>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-500">
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
                          ? 'bg-blue-100 text-blue-600'
                          : 'text-gray-700 hover:bg-gray-100'
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
                  className="flex items-center p-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  + Create Group
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/groups/join"
                  className="flex items-center p-2 text-gray-700 hover:bg-gray-100 rounded-lg"
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