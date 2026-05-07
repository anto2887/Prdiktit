import React, { useEffect, useState } from 'react';

const ActivationMessage = ({ 
  type = 'info', 
  title, 
  message, 
  autoDismiss = true, 
  dismissTime = 8000,
  onDismiss,
  showCloseButton = true 
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (autoDismiss && dismissTime > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss?.();
      }, dismissTime);
      return () => clearTimeout(timer);
    }
  }, [autoDismiss, dismissTime, onDismiss]);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  if (!isVisible) {
    return null;
  }

  const getMessageStyles = () => {
    switch (type) {
      case 'success':
        return {
          container: 'bg-green-50 border-green-200 text-green-800',
          icon: '✅',
          title: 'text-green-900',
          message: 'text-green-700'
        };
      case 'warning':
        return {
          container: 'bg-yellow-50 border-yellow-200 text-yellow-800',
          icon: '⚠️',
          title: 'text-yellow-900',
          message: 'text-yellow-700'
        };
      case 'error':
        return {
          container: 'bg-red-50 border-red-200 text-red-800',
          icon: '❌',
          title: 'text-red-900',
          message: 'text-red-700'
        };
      case 'info':
      default:
        return {
          container: 'bg-blue-50 border-blue-200 text-blue-800',
          icon: 'ℹ️',
          title: 'text-blue-900',
          message: 'text-blue-700'
        };
    }
  };

  const styles = getMessageStyles();

  return (
    <div className={`border rounded-lg p-4 mb-4 shadow-sm ${styles.container}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0 mr-3">
          <span className="text-xl">{styles.icon}</span>
        </div>
        
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className={`text-sm font-medium mb-1 ${styles.title}`}>
              {title}
            </h4>
          )}
          
          {message && (
            <p className={`text-sm ${styles.message}`}>
              {message}
            </p>
          )}
        </div>
        
        {showCloseButton && (
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 ml-3 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close message"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};

// Predefined activation message components
export const ActivationSuccessMessage = ({ title, message, ...props }) => (
  <ActivationMessage
    type="success"
    title={title || "Feature Unlocked!"}
    message={message || "New group features are now available for you to explore."}
    {...props}
  />
);

export const ActivationCountdownMessage = ({ weeksRemaining, ...props }) => (
  <ActivationMessage
    type="info"
    title="Features Unlocking Soon"
    message={`Only ${weeksRemaining} ${weeksRemaining === 1 ? 'week' : 'weeks'} until advanced group features become available!`}
    {...props}
  />
);

export const RivalryWeekMessage = ({ ...props }) => (
  <ActivationMessage
    type="warning"
    title="⚔️ Rivalry Week is Here!"
    message="Challenge your group members in this week's rivalry competition. Make your predictions and compete for glory!"
    autoDismiss={false}
    {...props}
  />
);

export const FeatureHighlightMessage = ({ feature, description, ...props }) => (
  <ActivationMessage
    type="info"
    title={`🎯 ${feature} Available`}
    message={description}
    {...props}
  />
);

export default ActivationMessage;
