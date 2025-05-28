// src/contexts/index.js
// Export all context hooks from the consolidated AppContext

export { 
  AppProvider,
  useAuth,
  useUser, 
  useMatches,
  usePredictions,
  useGroups,
  useNotifications,
  useLeagueContext,
  useGroupDetails,
  default as AppContext
} from './AppContext';

// Keep backward compatibility - these are the same hooks
export { useAuth as AuthProvider } from './AppContext';
export { useUser as UserProvider } from './AppContext';
export { useMatches as MatchProvider } from './AppContext';
export { usePredictions as PredictionProvider } from './AppContext';
export { useGroups as GroupProvider } from './AppContext';
export { useNotifications as NotificationProvider } from './AppContext';
export { useLeagueContext as LeagueProvider } from './AppContext';