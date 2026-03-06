import React, { useState, useEffect } from 'react';
import { useUser, useNotifications } from '../../contexts/AppContext';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import { applyTheme } from '../../utils/theme';

const Settings = () => {
  const { profile, loading, error, updateProfile } = useUser();
  const { showSuccess, showError } = useNotifications();

  // Load saved settings from profile
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

  // Load saved settings from profile when component mounts or profile changes
  useEffect(() => {
    if (profile?.settings) {
      if (profile.settings.notifications) {
        setNotifications(prev => ({
          ...prev,
          ...profile.settings.notifications
        }));
      }
      
      if (profile.settings.displayPreferences) {
        setDisplayPreferences(prev => ({
          ...prev,
          ...profile.settings.displayPreferences
        }));
        
        // Apply theme immediately when loaded
        if (profile.settings.displayPreferences.theme) {
          applyTheme(profile.settings.displayPreferences.theme);
        }
      }
    }
  }, [profile]);

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
    
    // Apply theme immediately when changed (before saving)
    if (name === 'theme') {
      applyTheme(value);
    }
  };

  const handleSaveSettings = async () => {
    try {
      // Only save theme preference (timezone and dateFormat are for display only)
      const settings = {
        notifications,
        displayPreferences: {
          theme: displayPreferences.theme
          // Note: timezone and dateFormat are not saved - browser defaults are used
        }
      };
      
      const success = await updateProfile({ settings });
      if (success) {
        showSuccess('Settings updated successfully');
        // Theme is already applied, no need to re-apply
      }
    } catch (err) {
      showError(err.message || 'Failed to update settings');
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-6">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg divide-y divide-gray-200 dark:divide-gray-700">
        {/* Notification Settings */}
        <div className="px-6 py-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Notification Settings
          </h2>
          <div className="space-y-4">
            {Object.entries(notifications).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <label 
                    htmlFor={key}
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
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
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Display Preferences
          </h2>
          <div className="space-y-4">
            <div>
              <label 
                htmlFor="theme" 
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Theme
              </label>
              <select
                id="theme"
                name="theme"
                value={displayPreferences.theme}
                onChange={handleDisplayPreferenceChange}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </div>

            <div>
              <label 
                htmlFor="timezone" 
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Timezone (Display Only)
              </label>
              <select
                id="timezone"
                name="timezone"
                value={displayPreferences.timezone}
                onChange={handleDisplayPreferenceChange}
                disabled
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 bg-gray-100 text-gray-500 rounded-md cursor-not-allowed"
                title="Timezone is automatically detected from your browser"
              >
                {Intl.supportedValuesOf('timeZone').map(zone => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Your browser's timezone is used automatically
              </p>
            </div>

            <div>
              <label 
                htmlFor="dateFormat" 
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Time Format (Display Only)
              </label>
              <select
                id="dateFormat"
                name="dateFormat"
                value={displayPreferences.dateFormat}
                onChange={handleDisplayPreferenceChange}
                disabled
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 bg-gray-100 text-gray-500 rounded-md cursor-not-allowed"
                title="Time format uses browser defaults"
              >
                <option value="12hour">12 Hour</option>
                <option value="24hour">24 Hour</option>
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Time format follows your browser's locale settings
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSaveSettings}
              className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
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