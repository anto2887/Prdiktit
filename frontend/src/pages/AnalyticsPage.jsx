// frontend/src/pages/AnalyticsPage.jsx
import React, { useState, useEffect } from 'react';
import { useNotifications } from '../contexts/AppContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';

const AnalyticsPage = () => {
  const { showError, showSuccess } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // This will be implemented when analytics features are ready
      // For now, show a placeholder
      setAnalytics({
        available: false,
        message: "Analytics features will be available from Week 5"
      });
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError('Failed to load analytics');
      showError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3">
          <h1 className="text-lg font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">Your prediction performance insights</p>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Analytics Coming Soon</h3>
            <p className="text-gray-500 text-sm px-4">
              Detailed analytics and performance insights will be available from Week 5 of the season.
              This will include prediction trends, accuracy patterns, and competitive analysis.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage; 