// src/App.jsx
import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AppProvider } from './contexts/AppContext';
import Routes from './Routes';
import ErrorBoundary from './components/common/ErrorBoundary';
import NotificationContainer from './components/common/NotificationContainer';
import './styles.css';

const App = () => {
  console.log("Rendering App with consolidated AppProvider");

  return (
    <ErrorBoundary>
      <Router>
        <AppProvider>
          <div className="app">
            <Routes />
            <NotificationContainer />
          </div>
        </AppProvider>
      </Router>
    </ErrorBoundary>
  );
};

export default App;