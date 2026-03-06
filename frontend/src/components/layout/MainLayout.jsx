// src/components/layout/MainLayout.jsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import Navigation from './Navigation';
import Sidebar from './Sidebar';
import Footer from './Footer';
import { useAuth } from '../../contexts/AppContext';
import LoadingSpinner from '../common/LoadingSpinner';
import BottomTabNavigation from '../mobile/BottomTabNavigation';

const MainLayout = () => {
  const { loading } = useAuth();

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Navigation />
      
      <div className="flex-grow flex">
        <Sidebar />
        
        <main className="flex-grow overflow-auto pb-16 md:pb-0">
          <div className="container mx-auto px-4 py-6">
            <Outlet />
          </div>
        </main>
      </div>
      
      <Footer />
      <BottomTabNavigation />
    </div>
  );
};

export default MainLayout;