// Enhanced Smart Scheduler API - Separate file to avoid conflicts
// frontend/src/api/enhancedScheduler.js
// Enhanced Smart Scheduler API integration

import api from './index';

/**
 * Enhanced Smart Scheduler API service
 * Provides methods to interact with the backend's Enhanced Smart Scheduler
 * with proactive fixture monitoring capabilities
 */
export const enhancedSchedulerApi = {
  
  /**
   * Get current Enhanced Smart Scheduler status
   * @returns {Promise<Object>} Scheduler status with mode, frequency, monitoring info
   */
  getStatus: async () => {
    try {
      const response = await api.client.get('/debug/scheduler-status');
      return {
        status: 'success',
        data: response.data
      };
    } catch (error) {
      process.env.NODE_ENV === 'development' && console.error('Error fetching scheduler status:', error);
      return {
        status: 'error',
        message: error.response?.data?.message || 'Failed to fetch scheduler status',
        details: error.response?.data?.details
      };
    }
  },

  /**
   * Force recalculation of processing schedule
   * @returns {Promise<Object>} Old and new schedule information
   */
  recalculateSchedule: async () => {
    try {
      const response = await api.client.post('/debug/recalculate-schedule');
      return {
        status: 'success',
        data: response.data
      };
    } catch (error) {
      process.env.NODE_ENV === 'development' && console.error('Error recalculating schedule:', error);
      return {
        status: 'error',
        message: error.response?.data?.message || 'Failed to recalculate schedule',
        details: error.response?.data?.details
      };
    }
  },

  /**
   * Manually trigger a processing cycle
   * @returns {Promise<Object>} Processing cycle results
   */
  triggerProcessing: async () => {
    try {
      const response = await api.client.post('/debug/trigger-processing');
      return {
        status: 'success',
        data: response.data
      };
    } catch (error) {
      process.env.NODE_ENV === 'development' && console.error('Error triggering processing:', error);
      return {
        status: 'error',
        message: error.response?.data?.message || 'Failed to trigger processing',
        details: error.response?.data?.details
      };
    }
  },

  /**
   * Manually trigger fixture monitoring
   * @returns {Promise<Object>} Fixture monitoring results
   */
  triggerFixtureMonitoring: async () => {
    try {
      const response = await api.client.post('/debug/trigger-fixture-monitoring');
      return {
        status: 'success',
        data: response.data
      };
    } catch (error) {
      process.env.NODE_ENV === 'development' && console.error('Error triggering fixture monitoring:', error);
      return {
        status: 'error',
        message: error.response?.data?.message || 'Failed to trigger fixture monitoring',
        details: error.response?.data?.details
      };
    }
  },

  /**
   * Get fixture monitoring status and recent changes
   * @returns {Promise<Object>} Fixture monitoring status
   */
  getFixtureMonitoringStatus: async () => {
    try {
      const response = await api.client.get('/debug/fixture-monitoring-status');
      return {
        status: 'success',
        data: response.data
      };
    } catch (error) {
      process.env.NODE_ENV === 'development' && console.error('Error fetching fixture monitoring status:', error);
      return {
        status: 'error',
        message: error.response?.data?.message || 'Failed to fetch fixture monitoring status',
        details: error.response?.data?.details
      };
    }
  },

  /**
   * Get enhanced health check with scheduler info
   * @returns {Promise<Object>} Health status with scheduler details
   */
  getHealthStatus: async () => {
    try {
      const response = await api.client.get('/health');
      return {
        status: 'success',
        data: response.data
      };
    } catch (error) {
      process.env.NODE_ENV === 'development' && console.error('Error fetching health status:', error);
      return {
        status: 'error',
        message: error.response?.data?.message || 'Failed to fetch health status',
        details: error.response?.data?.details
      };
    }
  }

};

/**
 * Utility functions for Enhanced Scheduler data
 */
export const enhancedSchedulerUtils = {
  
  /**
   * Format scheduler mode for display
   * @param {string} mode - Scheduler mode (e.g., 'high_frequency', 'match_day', 'minimal')
   * @returns {Object} Display info with icon and description
   */
  formatSchedulerMode: (mode) => {
    const modes = {
      'high_frequency': {
        icon: '⚡',
        name: 'High Frequency',
        description: 'Live matches - every 2 minutes',
        color: 'text-red-500'
      },
      'match_day': {
        icon: '🔄',
        name: 'Match Day',
        description: 'Around match times - every 5 minutes',
        color: 'text-orange-500'
      },
      'moderate': {
        icon: '📊',
        name: 'Moderate',
        description: 'Regular processing - every 15 minutes',
        color: 'text-blue-500'
      },
      'minimal': {
        icon: '💤',
        name: 'Minimal',
        description: 'Quiet periods - every 30-60 minutes',
        color: 'text-gray-500'
      }
    };
    
    return modes[mode] || {
      icon: '❓',
      name: 'Unknown',
      description: 'Unknown mode',
      color: 'text-gray-400'
    };
  },

  /**
   * Format frequency in seconds to human readable
   * @param {number} seconds - Frequency in seconds
   * @returns {string} Human readable frequency
   */
  formatFrequency: (seconds) => {
    if (seconds < 60) {
      return `${seconds} seconds`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
      const hours = Math.floor(seconds / 3600);
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    }
  },

  /**
   * Check if scheduler is in optimal state
   * @param {Object} schedulerData - Scheduler status data
   * @returns {Object} Optimization status and suggestions
   */
  analyzeSchedulerHealth: (schedulerData) => {
    const issues = [];
    const suggestions = [];
    
    if (!schedulerData.is_running) {
      issues.push('Scheduler not running');
      suggestions.push('Restart the Enhanced Smart Scheduler');
    }
    
    if (!schedulerData.processor_available) {
      issues.push('Match processor not available');
      suggestions.push('Check match processor initialization');
    }
    
    if (!schedulerData.fixture_monitor_available) {
      issues.push('Fixture monitor not available');
      suggestions.push('Check fixture monitoring service');
    }
    
    if (schedulerData.todays_matches > 0 && !schedulerData.fixture_monitoring_enabled) {
      issues.push('Fixture monitoring disabled on match day');
      suggestions.push('Enable fixture monitoring for better accuracy');
    }
    
    return {
      isHealthy: issues.length === 0,
      issues,
      suggestions,
      score: Math.max(0, 100 - (issues.length * 25))
    };
  }

};

// Export default enhanced scheduler service
export default enhancedSchedulerApi;