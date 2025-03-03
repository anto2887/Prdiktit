// src/App.jsx
import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { UserProvider } from './contexts/UserContext';
import { GroupProvider } from './contexts/GroupContext';
import { MatchProvider } from './contexts/MatchContext';
import { PredictionProvider } from './contexts/PredictionContext';
import Routes from './Routes';
import ErrorBoundary from './components/common/ErrorBoundary';
import NotificationContainer from './components/common/NotificationContainer';
import './styles.css';

const App = () => {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <NotificationProvider>
            <UserProvider>
              <GroupProvider>
                <MatchProvider>
                  <PredictionProvider>
                    <div className="app">
                      <Routes />
                      <NotificationContainer />
                    </div>
                  </PredictionProvider>
                </MatchProvider>
              </GroupProvider>
            </UserProvider>
          </NotificationProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
};

export default App;