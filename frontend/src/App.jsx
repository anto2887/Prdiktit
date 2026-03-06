// src/App.jsx
import React, { useEffect, useRef } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider, useUser } from './contexts';
import Routes from './Routes';
import ErrorBoundary from './components/common/ErrorBoundary';
import NotificationContainer from './components/common/NotificationContainer';
import { initializeTheme, clearSavedTheme } from './utils/theme';
import './styles.css';

// Theme initializer component (must be inside AppProvider)
const ThemeInitializer = () => {
  const { profile } = useUser();
  const hasClearedLocalStorage = useRef(false);
  
  useEffect(() => {
    // Get theme from profile settings (source of truth)
    const savedTheme = profile?.settings?.displayPreferences?.theme || null;
    
    // Always apply a theme (never skip)
    // Priority: profile theme > light default
    const themeToApply = savedTheme || 'light';
    initializeTheme(themeToApply);
    
    // Clear localStorage after profile loads (only once)
    // This prevents localStorage from conflicting with profile settings
    if (profile && !hasClearedLocalStorage.current) {
      clearSavedTheme();
      hasClearedLocalStorage.current = true;
    }
    
    // System theme is now a distinct blue-tinted theme, not OS-based
    // No watcher needed
  }, [profile?.settings?.displayPreferences?.theme, profile]);
  
  return null;
};

function App() {
  // Initialize theme immediately on app load (before profile loads)
  // Use localStorage only for FOUC prevention on initial load
  useEffect(() => {
    initializeTheme(null, true); // isInitialLoad = true
  }, []);
  
  return (
    <ErrorBoundary>
      <AppProvider>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true
          }}
        >
          <ThemeInitializer />
          <Routes />
          <NotificationContainer />
        </BrowserRouter>
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;