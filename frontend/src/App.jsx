// src/App.jsx
import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider, useUser } from './contexts';
import Routes from './Routes';
import ErrorBoundary from './components/common/ErrorBoundary';
import NotificationContainer from './components/common/NotificationContainer';
import { initializeTheme, watchSystemTheme } from './utils/theme';
import './styles.css';

// Theme initializer component (must be inside AppProvider)
const ThemeInitializer = () => {
  const { profile } = useUser();
  
  useEffect(() => {
    // Initialize theme from profile settings or fallback to system
    const savedTheme = profile?.settings?.displayPreferences?.theme || null;
    if (savedTheme) {
      initializeTheme(savedTheme);
    }
    
    // If theme is 'system', watch for system theme changes
    if (savedTheme === 'system' || !savedTheme) {
      const cleanup = watchSystemTheme(() => {
        // Re-apply theme when system preference changes
        const currentTheme = profile?.settings?.displayPreferences?.theme || 'system';
        if (currentTheme === 'system' || !currentTheme) {
          initializeTheme('system');
        }
      });
      return cleanup;
    }
  }, [profile?.settings?.displayPreferences?.theme]);
  
  return null;
};

function App() {
  // Initialize theme immediately on app load (before profile loads)
  useEffect(() => {
    initializeTheme(null); // Will use localStorage or system default
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