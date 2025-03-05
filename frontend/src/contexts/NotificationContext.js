// src/contexts/NotificationContext.js
import React, { createContext, useContext, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback((notification) => {
    const id = notification.id || uuidv4();
    const timeout = notification.timeout || 5000;

    setNotifications(prev => [
      ...prev,
      {
        id,
        type: notification.type || 'info',
        message: notification.message,
        timeout
      }
    ]);

    // Auto remove notification after timeout
    if (timeout > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, timeout);
    }

    return id;
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  const showSuccess = useCallback((message, timeout = 5000) => {
    return addNotification({
      type: 'success',
      message,
      timeout
    });
  }, [addNotification]);

  const showError = useCallback((message, timeout = 7000) => {
    return addNotification({
      type: 'error',
      message,
      timeout
    });
  }, [addNotification]);

  const showWarning = useCallback((message, timeout = 6000) => {
    return addNotification({
      type: 'warning',
      message,
      timeout
    });
  }, [addNotification]);

  const showInfo = useCallback((message, timeout = 5000) => {
    return addNotification({
      type: 'info',
      message,
      timeout
    });
  }, [addNotification]);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        removeNotification,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        clearAllNotifications
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationContext;