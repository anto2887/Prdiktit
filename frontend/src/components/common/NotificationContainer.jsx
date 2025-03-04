// src/components/common/NotificationContainer.jsx
import React from 'react';
import { useNotifications } from '../../contexts/NotificationContext';
import { X } from 'lucide-react';

const NotificationContainer = () => {
  const { notifications, removeNotification } = useNotifications();

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col space-y-2">
      {notifications.map((notification) => (
        <div 
          key={notification.id}
          className={`p-4 rounded-lg shadow-lg max-w-md w-full flex items-center justify-between
            ${notification.type === 'success' ? 'bg-green-100 text-green-800' : ''}
            ${notification.type === 'error' ? 'bg-red-100 text-red-800' : ''}
            ${notification.type === 'warning' ? 'bg-yellow-100 text-yellow-800' : ''}
            ${notification.type === 'info' ? 'bg-blue-100 text-blue-800' : ''}`}
        >
          <span>{notification.message}</span>
          <button 
            onClick={() => removeNotification(notification.id)}
            className="ml-4 text-gray-500 hover:text-gray-700"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default NotificationContainer;