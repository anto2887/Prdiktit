// src/contexts/index.js
// Export all context hooks from a single entry point

export { default as AuthContext, AuthProvider, useAuth } from './AuthContext';
export { default as UserContext, UserProvider, useUser } from './UserContext';
export { default as MatchContext, MatchProvider, useMatches } from './MatchContext';
export { default as PredictionContext, PredictionProvider, usePredictions } from './PredictionContext';
export { default as GroupContext, GroupProvider, useGroups } from './GroupContext';
export { default as NotificationContext, NotificationProvider, useNotifications } from './NotificationContext';