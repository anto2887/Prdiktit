// src/App.jsx
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from './contexts';
import Routes from './Routes';
import ErrorBoundary from './components/common/ErrorBoundary';
import NotificationContainer from './components/common/NotificationContainer';
import './styles.css';

function App() {
  console.log('🔄 App: Rendering App with consolidated AppProvider', new Date().toISOString());
  
  return (
    <ErrorBoundary>
      <AppProvider>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true
          }}
        >
          <Routes />
          <NotificationContainer />
        </BrowserRouter>
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;