// src/Routes.jsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

// Layout
import MainLayout from './components/layout/MainLayout';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';

// Prediction Pages
import PredictionsPage from './pages/PredictionsPage';
import PredictionFormPage from './pages/PredictionFormPage';
import PredictionHistoryPage from './pages/PredictionHistoryPage';

// Group Pages
import GroupsPage from './pages/GroupsPage';
import CreateGroupPage from './pages/CreateGroupPage';
import JoinGroupPage from './pages/JoinGroupPage';
import GroupDetailsPage from './pages/GroupDetailsPage';
import GroupManagementPage from './pages/GroupManagementPage';

// Error Pages
import NotFoundPage from './pages/NotFoundPage';

// Protected Route Component
import ProtectedRoute from './components/auth/ProtectedRoute';

const AppRoutes = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={
        isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />
      } />
      <Route path="/register" element={
        isAuthenticated ? <Navigate to="/dashboard" replace /> : <RegisterPage />
      } />
      
      {/* Protected routes with MainLayout */}
      <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        {/* Dashboard routes */}
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        
        {/* Prediction routes */}
        <Route path="/predictions" element={<PredictionsPage />} />
        <Route path="/predictions/new" element={<PredictionFormPage />} />
        <Route path="/predictions/edit/:id" element={<PredictionFormPage />} />
        <Route path="/predictions/history" element={<PredictionHistoryPage />} />
        
        {/* Group routes */}
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="/groups/create" element={<CreateGroupPage />} />
        <Route path="/groups/join" element={<JoinGroupPage />} />
        <Route path="/groups/:groupId" element={<GroupDetailsPage />} />
        <Route path="/groups/:groupId/manage" element={<GroupManagementPage />} />
      </Route>
      
      {/* Home route with redirect */}
      <Route path="/" element={
        isAuthenticated ? <Navigate to="/dashboard" replace /> : <HomePage />
      } />
      
      {/* 404 route */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default AppRoutes;