import React, { useState } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useNotifications } from '../../contexts/NotificationContext';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';

const Settings = () => {
  const { loading, error, updateProfile } = useUser();
  const { showSuccess, showError } = useNotifications();

  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    predictionReminders: true,
    matchUpdates: true,
    groupActivity: true
  });

  const [displayPreferences, setDisplayPreferences] = useState({
    theme: 'light',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dateFormat: '12hour'
  });

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  const handleNotificationChange = (setting) => {
    setNotifications(prev => ({
      ...prev,
      [setting]: !prev[setting]
    }));
  };

  const handleDisplayPreferenceChange = (e) => {
    const { name, value } = e.target;
    setDisplayPreferences(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveSettings = async () => {
    try {
      const settings = {
        notifications,
        displayPreferences
      };
      
      const success = await updateProfile({ settings });
      if (success) {
        showSuccess('Settings updated successfully');
      }
    } catch (err) {
      showError(err.message || 'Failed to update settings');
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-6">
      <div className="bg-white shadow rounded-lg divide-y divide-gray-200">
        {/* Notification Settings */}
        <div className="px-6 py-4">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Notification Settings
          </h2>
          <div className="space-y-4">
            {Object.entries(notifications).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <label 
                    htmlFor={key}
                    className="text-sm font-medium text-gray-700"
                  >
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  <p className="text-sm text-gray-500">
                    Receive notifications about {key.toLowerCase()}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={value}
                  onClick={() => handleNotificationChange(key)}
                  className={`${
                    value ? 'bg-blue-600' : 'bg-gray-200'
                  } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                >
                  <span
                    aria-hidden="true"
                    className={`${
                      value ? 'translate-x-5' : 'translate-x-0'
                    } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Display Preferences */}
        <div className="px-6 py-4">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Display Preferences
          </h2>
          <div className="space-y-4">
            <div>
              <label 
                htmlFor="theme" 
                className="block text-sm font-medium text-gray-700"
              >
                Theme
              </label>
              <select
                id="theme"
                name="theme"
                value={displayPreferences.theme}
                onChange={handleDisplayPreferenceChange}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </div>

            <div>
              <label 
                htmlFor="timezone" 
                className="block text-sm font-medium text-gray-700"
              >
                Timezone
              </label>
              <select
                id="timezone"
                name="timezone"
                value={displayPreferences.timezone}
                onChange={handleDisplayPreferenceChange}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
              >
                {Intl.supportedValuesOf('timeZone').map(zone => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label 
                htmlFor="dateFormat" 
                className="block text-sm font-medium text-gray-700"
              >
                Time Format
              </label>
              <select
                id="dateFormat"
                name="dateFormat"
                value={displayPreferences.dateFormat}
                onChange={handleDisplayPreferenceChange}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
              >
                <option value="12hour">12 Hour</option>
                <option value="24hour">24 Hour</option>
              </select>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="px-6 py-4 bg-gray-50">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSaveSettings}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;