import React, { useState, useEffect, useRef } from 'react';
import { useUser, useNotifications } from '../../contexts/AppContext';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import { applyTheme } from '../../utils/theme';
import api from '../../api';
import { useI18n } from '../../i18n';

const Settings = () => {
  const { profile, loading, error, updateProfile } = useUser();
  const { showSuccess, showError } = useNotifications();
  const { t } = useI18n();
  const systemThemeWatcher = useRef(null);

  // Notification preferences (backend-driven, separate table)
  const [notifications, setNotifications] = useState({
    email_enabled: true,
    prediction_reminders: true,
    match_result_updates: true,
    group_activity: true,
    reminder_24h: true,
    reminder_1h: true
  });
  const [notifLoading, setNotifLoading] = useState(true);

  const [displayPreferences, setDisplayPreferences] = useState({
    theme: 'light',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dateFormat: '12hour'
  });

  // Load saved settings from profile when component mounts or profile changes
  useEffect(() => {
    // Clean up existing watcher
    if (systemThemeWatcher.current) {
      systemThemeWatcher.current();
      systemThemeWatcher.current = null;
    }
    
    if (profile?.settings) {
      if (profile.settings.displayPreferences) {
        setDisplayPreferences(prev => ({
          ...prev,
          ...profile.settings.displayPreferences
        }));
        
        // Apply theme immediately when loaded
        const theme = profile.settings.displayPreferences.theme;
        if (theme) {
          applyTheme(theme);
          // System theme is now a distinct blue-tinted theme, no watcher needed
        }
      }
    }
  }, [profile]);

  // Load notification preferences from backend on mount
  useEffect(() => {
    const loadNotificationPrefs = async () => {
      try {
        const response = await api.client.get('/notifications/preferences');
        // Axios interceptor wraps DataResponse as-is, so we expect { status, data }
        if (response && response.status === 'success' && response.data) {
          setNotifications(prev => ({
            ...prev,
            ...response.data
          }));
        }
      } catch (err) {
        console.error('Failed to load notification prefs:', err);
      } finally {
        setNotifLoading(false);
      }
    };

    loadNotificationPrefs();
  }, []);

  // Cleanup watcher on unmount
  useEffect(() => {
    return () => {
      if (systemThemeWatcher.current) {
        systemThemeWatcher.current();
        systemThemeWatcher.current = null;
      }
    };
  }, []);

  if (loading || notifLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  const handleNotificationChange = (field) => {
    setNotifications(prev => ({
      ...prev,
      [field]: !prev[field]
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
      // Clean up existing watcher if any (no longer needed, but kept for cleanup)
      if (systemThemeWatcher.current) {
        systemThemeWatcher.current();
        systemThemeWatcher.current = null;
      }
      
      // Apply the theme
      // System theme is now a distinct blue-tinted theme, not OS-based
      applyTheme(value);
    }
  };

  const handleSaveSettings = async () => {
    try {
      // First, persist notification preferences via dedicated endpoint
      await api.client.put('/notifications/preferences', notifications);

      // Then, persist display preferences via existing profile flow
      const success = await updateProfile({
        settings: {
        displayPreferences: {
          theme: displayPreferences.theme,
          timezone: displayPreferences.timezone,
          dateFormat: displayPreferences.dateFormat,
        }
        }
      });
      if (success) {
        showSuccess(t('settings.saved'));
      }
    } catch (err) {
      showError(err.message || t('settings.saveFailed'));
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-6">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg divide-y divide-gray-200 dark:divide-gray-700">
        {/* Notification Settings */}
        <div className="px-6 py-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            {t('settings.notificationSettings')}
          </h2>
          <div className="space-y-4">
            {/* Master toggle: Email Notifications */}
            <div className="flex items-center justify-between">
              <div>
                <label
                  htmlFor="email_enabled"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {t('settings.emailNotifications')}
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('settings.emailNotificationsDesc')}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={notifications.email_enabled}
                onClick={() => handleNotificationChange('email_enabled')}
                className={`${
                  notifications.email_enabled ? 'bg-blue-600' : 'bg-gray-200'
                } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
              >
                <span
                  aria-hidden="true"
                  className={`${
                    notifications.email_enabled ? 'translate-x-5' : 'translate-x-0'
                  } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                />
              </button>
            </div>

            <div className={!notifications.email_enabled ? 'opacity-50 pointer-events-none space-y-3' : 'space-y-3'}>
              {/* Prediction Reminders + sub-toggles */}
              <div className="flex items-center justify-between">
                <div>
                  <label
                    htmlFor="prediction_reminders"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {t('settings.predictionReminders')}
                  </label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('settings.predictionRemindersDesc')}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notifications.prediction_reminders}
                  onClick={() => handleNotificationChange('prediction_reminders')}
                  className={`${
                    notifications.prediction_reminders ? 'bg-blue-600' : 'bg-gray-200'
                  } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                >
                  <span
                    aria-hidden="true"
                    className={`${
                      notifications.prediction_reminders ? 'translate-x-5' : 'translate-x-0'
                    } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                  />
                </button>
              </div>

              <div className={!notifications.prediction_reminders ? 'ml-6 space-y-2 opacity-50 pointer-events-none' : 'ml-6 space-y-2'}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {t('settings.reminder24h')}
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notifications.reminder_24h}
                    onClick={() => handleNotificationChange('reminder_24h')}
                    className={`${
                      notifications.reminder_24h ? 'bg-blue-600' : 'bg-gray-200'
                    } relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                  >
                    <span
                      aria-hidden="true"
                      className={`${
                        notifications.reminder_24h ? 'translate-x-4' : 'translate-x-0'
                      } pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {t('settings.reminder1h')}
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notifications.reminder_1h}
                    onClick={() => handleNotificationChange('reminder_1h')}
                    className={`${
                      notifications.reminder_1h ? 'bg-blue-600' : 'bg-gray-200'
                    } relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                  >
                    <span
                      aria-hidden="true"
                      className={`${
                        notifications.reminder_1h ? 'translate-x-4' : 'translate-x-0'
                      } pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                    />
                  </button>
                </div>
              </div>

              {/* Match Result Updates */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  <label
                    htmlFor="match_result_updates"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {t('settings.matchResultUpdates')}
                  </label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('settings.matchResultUpdatesDesc')}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notifications.match_result_updates}
                  onClick={() => handleNotificationChange('match_result_updates')}
                  className={`${
                    notifications.match_result_updates ? 'bg-blue-600' : 'bg-gray-200'
                  } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                >
                  <span
                    aria-hidden="true"
                    className={`${
                      notifications.match_result_updates ? 'translate-x-5' : 'translate-x-0'
                    } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                  />
                </button>
              </div>

              {/* Group Activity */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  <label 
                    htmlFor="group_activity"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {t('settings.groupActivity')}
                  </label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('settings.groupActivityDesc')}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notifications.group_activity}
                  onClick={() => handleNotificationChange('group_activity')}
                  className={`${
                    notifications.group_activity ? 'bg-blue-600' : 'bg-gray-200'
                  } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                >
                  <span
                    aria-hidden="true"
                    className={`${
                      notifications.group_activity ? 'translate-x-5' : 'translate-x-0'
                    } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Display Preferences */}
        <div className="px-6 py-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            {t('settings.displayPreferences')}
          </h2>
          <div className="space-y-4">
            <div>
              <label 
                htmlFor="theme" 
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {t('settings.theme')}
              </label>
              <select
                id="theme"
                name="theme"
                value={displayPreferences.theme}
                onChange={handleDisplayPreferenceChange}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
              >
                <option value="light">{t('settings.themeLight')}</option>
                <option value="dark">{t('settings.themeDark')}</option>
                <option value="system">{t('settings.themeSystem')}</option>
              </select>
            </div>

            <div>
              <label 
                htmlFor="timezone" 
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {t('settings.timezoneDisplayOnly')}
              </label>
              <select
                id="timezone"
                name="timezone"
                value={displayPreferences.timezone}
                onChange={handleDisplayPreferenceChange}
                disabled
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 bg-gray-100 text-gray-500 rounded-md cursor-not-allowed"
                title={t('settings.timezoneAutoTitle')}
              >
                {Intl.supportedValuesOf('timeZone').map(zone => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t('settings.timezoneAutoBody')}
              </p>
            </div>

            <div>
              <label 
                htmlFor="dateFormat" 
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {t('settings.timeFormatDisplayOnly')}
              </label>
              <select
                id="dateFormat"
                name="dateFormat"
                value={displayPreferences.dateFormat}
                onChange={handleDisplayPreferenceChange}
                disabled
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 bg-gray-100 text-gray-500 rounded-md cursor-not-allowed"
                title={t('settings.timeFormatAutoTitle')}
              >
                <option value="12hour">{t('settings.format12')}</option>
                <option value="24hour">{t('settings.format24')}</option>
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t('settings.timeFormatAutoBody')}
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
              {t('settings.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;