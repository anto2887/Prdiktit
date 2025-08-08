// src/Routes.jsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts';

// Layout
import MainLayout from './components/layout/MainLayout';

// Import all pages from index
import {
  HomePage,
  LoginPage,
  RegisterPage,
  DashboardPage,
  ProfilePage,
  SettingsPage,
  PredictionsPage,
  PredictionFormPage,
  PredictionHistoryPage,
  AnalyticsPage,
  GroupsPage,
  CreateGroupPage,
  JoinGroupPage,
  GroupDetailsPage,
  GroupManagementPage,
  GroupPredictionsPage,
  RivalryPage,
  NotFoundPage
} from './pages';

// Protected Route Component
import ProtectedRoute from './components/auth/ProtectedRoute';

const AppRoutes = () => {
  const { isAuthenticated, loading, user } = useAuth();
  
  console.log('🔍 Routes.jsx - Auth Debug:', {
    isAuthenticated,
    loading,
    user: user ? 'User exists' : 'No user',
    timestamp: new Date().toISOString()
  });

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
        
        {/* Analytics routes */}
        <Route path="/analytics" element={<AnalyticsPage />} />
        
        {/* Group routes */}
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="/groups/create" element={<CreateGroupPage />} />
        <Route path="/groups/join" element={<JoinGroupPage />} />
        <Route path="/groups/:groupId" element={<GroupDetailsPage />} />
        <Route path="/groups/:groupId/predictions" element={<GroupPredictionsPage />} />
        <Route path="/groups/:groupId/rivalries" element={<RivalryPage />} />
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