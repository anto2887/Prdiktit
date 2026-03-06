// src/App.jsx
import React, { useEffect, useRef } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider, useUser } from './contexts';
import Routes from './Routes';
import ErrorBoundary from './components/common/ErrorBoundary';
import NotificationContainer from './components/common/NotificationContainer';
import { initializeTheme, watchSystemTheme, clearSavedTheme } from './utils/theme';
import './styles.css';

// Theme initializer component (must be inside AppProvider)
const ThemeInitializer = () => {
  const { profile } = useUser();
  const hasClearedLocalStorage = useRef(false);
  
  useEffect(() => {
    // Get theme from profile settings (source of truth)
    const savedTheme = profile?.settings?.displayPreferences?.theme || null;
    
    // Always apply a theme (never skip)
    // Priority: profile theme > system default
    const themeToApply = savedTheme || 'system';
    initializeTheme(themeToApply);
    
    // Clear localStorage after profile loads (only once)
    // This prevents localStorage from conflicting with profile settings
    if (profile && !hasClearedLocalStorage.current) {
      clearSavedTheme();
      hasClearedLocalStorage.current = true;
    }
    
    // Only watch system theme changes if user explicitly chose "system"
    // Don't watch if profile has no theme (let it use system default without watching)
    let cleanup = null;
    if (savedTheme === 'system') {
      cleanup = watchSystemTheme(() => {
        // Re-apply system theme when system preference changes
        initializeTheme('system');
      });
    }
    
    return () => {
      if (cleanup) cleanup();
    };
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