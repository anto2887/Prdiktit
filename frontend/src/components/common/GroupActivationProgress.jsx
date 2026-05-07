import React, { useState, useEffect } from 'react';
import { useGroups } from '../../contexts/AppContext';
import { useI18n } from '../../i18n';

const GroupActivationProgress = ({ groupId, showRivalryProgress = true }) => {
  const { userGroups, currentGroup } = useGroups();
  const { t } = useI18n();
  const [isVisible, setIsVisible] = useState(true);

  // Get the group data from either currentGroup or userGroups
  const group = currentGroup || userGroups.find(g => g.id === groupId);
  
  // Auto-hide after 10 seconds if features are already active
  useEffect(() => {
    if (group && group.is_activated && group.weeks_until_next_rivalry === 0) {
      const timer = setTimeout(() => setIsVisible(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [group]);

  if (!group || !isVisible) {
    return null;
  }

  // Extract activation data from the group object (API data)
  const {
    is_activated,
    activation_week,
    next_rivalry_week,
    current_week,
    weeks_until_activation,
    weeks_until_next_rivalry,
    activation_progress,
    is_rivalry_week
  } = group;

  // Don't show if no activation data or if data is incomplete
  if (!activation_week || !current_week || activation_progress === undefined) {
    console.warn('GroupActivationProgress: Missing or incomplete activation data for group', groupId, group);
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-yellow-800">
            ⚠️ {t('groupActivation.loadingTitle')}
          </h3>
          <button
            onClick={() => setIsVisible(false)}
            className="text-yellow-400 hover:text-yellow-600 transition-colors"
          >
            ✕
          </button>
        </div>
        <p className="text-sm text-yellow-700">
          {t('groupActivation.loadingBody')}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-6 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-800">
          {is_activated ? `🎉 ${t('groupActivation.activeTitle')}` : `⏳ ${t('groupActivation.unlockingTitle')}`}
        </h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          ✕
        </button>
      </div>

      {!is_activated ? (
        // Pre-activation state
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>{t('groupActivation.progressToActivation')}</span>
            <span>{weeks_until_activation} {t('groupActivation.weeksRemaining')}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-blue-500 to-indigo-500 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${activation_progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-600">
            {t('groupActivation.unlockAtWeek')} {activation_week} ({t('groupActivation.currentlyWeek')} {current_week})
          </p>
          
          {/* Activation countdown */}
          {weeks_until_activation > 0 && (
            <div className="bg-blue-100 border border-blue-300 rounded-md p-3">
              <p className="text-sm text-blue-800 font-medium">
                🚀 {weeks_until_activation === 1 ? t('groupActivation.nextWeek') : `${weeks_until_activation} ${t('rivalries.week').toLowerCase()}`} {t('groupActivation.until')}
              </p>
              <ul className="text-sm text-blue-700 mt-1 space-y-1">
                <li>• {t('groupActivation.featureRivalryUnlock')}</li>
                <li>• {t('groupActivation.featureAnalytics')}</li>
                <li>• {t('groupActivation.featureBonuses')}</li>
                <li>• {t('groupActivation.featureEnhanced')}</li>
                <li>• {t('groupActivation.featureComeback')}</li>
              </ul>
            </div>
          )}
        </div>
      ) : (
        // Post-activation state
        <div className="space-y-3">
          <div className="bg-green-100 border border-green-300 rounded-md p-3 mb-3">
            <p className="text-sm text-green-800 font-medium">
              ✅ {t('groupActivation.allFeaturesActive')}
            </p>
          </div>

          {showRivalryProgress && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>{t('groupActivation.nextRivalryWeek')}</span>
                <span>{weeks_until_next_rivalry === 0 ? t('groupActivation.thisWeek') : `${weeks_until_next_rivalry} ${t('groupActivation.weeksAway')}`}</span>
              </div>
              
              {weeks_until_next_rivalry > 0 ? (
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${Math.min(100, Math.max(0, ((current_week - activation_week) / 4) * 100))}%` }}
                  />
                </div>
              ) : (
                <div className="bg-purple-100 border border-purple-300 rounded-md p-3">
                  <p className="text-sm text-purple-800 font-medium">
                    ⚔️ {t('groupActivation.rivalryWeekHere')}
                  </p>
                </div>
              )}

              <p className="text-sm text-gray-600">
                {t('groupActivation.rivalryCadence')}
              </p>
            </div>
          )}

          {/* Feature highlights */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-indigo-50 border border-indigo-200 rounded-md p-3">
              <h4 className="text-sm font-medium text-indigo-800 mb-1">📊 {t('groupActivation.analytics')}</h4>
              <p className="text-xs text-indigo-600">{t('groupActivation.analyticsDesc')}</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
              <h4 className="text-sm font-medium text-orange-800 mb-1">🎯 {t('groupActivation.rivalries')}</h4>
              <p className="text-xs text-orange-600">{t('groupActivation.rivalriesDesc')}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-md p-3">
              <h4 className="text-sm font-medium text-green-800 mb-1">⭐ {t('groupActivation.bonuses')}</h4>
              <p className="text-xs text-green-600">{t('groupActivation.bonusesDesc')}</p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-md p-3">
              <h4 className="text-sm font-medium text-purple-800 mb-1">🏆 {t('groupActivation.leaderboards')}</h4>
              <p className="text-xs text-purple-600">{t('groupActivation.leaderboardsDesc')}</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <h4 className="text-sm font-medium text-yellow-800 mb-1">🎯 {t('groupActivation.comebackChallenge')}</h4>
              <p className="text-xs text-yellow-600">{t('groupActivation.comebackChallengeDesc')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupActivationProgress;
