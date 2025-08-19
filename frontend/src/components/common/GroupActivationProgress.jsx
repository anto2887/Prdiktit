import React, { useEffect, useState } from 'react';
import { useGroupActivation } from '../../contexts/AppContext';

const GroupActivationProgress = ({ groupId, showRivalryProgress = true }) => {
  const { groupActivation, fetchGroupActivationState } = useGroupActivation();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (groupId) {
      fetchGroupActivationState(groupId);
    }
  }, [groupId, fetchGroupActivationState]);

  // Auto-hide after 10 seconds if features are already active
  useEffect(() => {
    if (groupActivation.isActive && groupActivation.weeksUntilNextRivalry === 0) {
      const timer = setTimeout(() => setIsVisible(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [groupActivation.isActive, groupActivation.weeksUntilNextRivalry]);

  if (!groupActivation || !isVisible) {
    return null;
  }

  const {
    isActive,
    activationWeek,
    nextRivalryWeek,
    currentWeek,
    weeksUntilActivation,
    weeksUntilNextRivalry,
    activationProgress,
    rivalryProgress
  } = groupActivation;

  // Don't show if no activation data
  if (!activationWeek) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-6 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-800">
          {isActive ? '🎉 Group Features Active!' : '⏳ Group Features Unlocking Soon'}
        </h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          ✕
        </button>
      </div>

      {!isActive ? (
        // Pre-activation state
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Progress to activation</span>
            <span>{weeksUntilActivation} weeks remaining</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-blue-500 to-indigo-500 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${activationProgress}%` }}
            />
          </div>
          <p className="text-sm text-gray-600">
            Features will unlock at week {activationWeek} (currently week {currentWeek})
          </p>
          
          {/* Activation countdown */}
          {weeksUntilActivation > 0 && (
            <div className="bg-blue-100 border border-blue-300 rounded-md p-3">
              <p className="text-sm text-blue-800 font-medium">
                🚀 {weeksUntilActivation === 1 ? 'Next week' : `${weeksUntilActivation} weeks`} until:
              </p>
              <ul className="text-sm text-blue-700 mt-1 space-y-1">
                <li>• Rivalry challenges unlock</li>
                <li>• Advanced analytics become available</li>
                <li>• Bonus point opportunities</li>
                <li>• Enhanced group features</li>
              </ul>
            </div>
          )}
        </div>
      ) : (
        // Post-activation state
        <div className="space-y-3">
          <div className="bg-green-100 border border-green-300 rounded-md p-3 mb-3">
            <p className="text-sm text-green-800 font-medium">
              ✅ All group features are now active!
            </p>
          </div>

          {showRivalryProgress && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Next rivalry week</span>
                <span>{weeksUntilNextRivalry === 0 ? 'This week!' : `${weeksUntilNextRivalry} weeks away`}</span>
              </div>
              
              {weeksUntilNextRivalry > 0 ? (
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${rivalryProgress}%` }}
                  />
                </div>
              ) : (
                <div className="bg-purple-100 border border-purple-300 rounded-md p-3">
                  <p className="text-sm text-purple-800 font-medium">
                    ⚔️ Rivalry Week is here! Challenge your group members!
                  </p>
                </div>
              )}

              <p className="text-sm text-gray-600">
                Rivalry weeks occur every 4 weeks after activation
              </p>
            </div>
          )}

          {/* Feature highlights */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-indigo-50 border border-indigo-200 rounded-md p-3">
              <h4 className="text-sm font-medium text-indigo-800 mb-1">📊 Analytics</h4>
              <p className="text-xs text-indigo-600">Advanced performance insights</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
              <h4 className="text-sm font-medium text-orange-800 mb-1">🎯 Rivalries</h4>
              <p className="text-xs text-orange-600">Weekly challenges & competitions</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-md p-3">
              <h4 className="text-sm font-medium text-green-800 mb-1">⭐ Bonuses</h4>
              <p className="text-xs text-green-600">Extra point opportunities</p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-md p-3">
              <h4 className="text-sm font-medium text-purple-800 mb-1">🏆 Leaderboards</h4>
              <p className="text-xs text-purple-600">Enhanced competitive tracking</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupActivationProgress;
