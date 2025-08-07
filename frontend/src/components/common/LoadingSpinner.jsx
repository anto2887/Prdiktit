import React, { useState, useEffect } from 'react';

const LoadingSpinner = ({ 
  message = "Loading...",
  size = "medium",
  showProgress = false,
  progress = 0,
  timeout = 10000, // 10 seconds
  className = "",
  fullScreen = false
}) => {
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  
  useEffect(() => {
    if (timeout > 0) {
      const timer = setTimeout(() => {
        setShowTimeoutWarning(true);
      }, timeout);
      
      return () => clearTimeout(timer);
    }
  }, [timeout]);
  
  const sizeClasses = {
    small: "w-4 h-4",
    medium: "w-8 h-8", 
    large: "w-12 h-12"
  };
  
  const spinnerContent = (
    <div className={`flex flex-col items-center justify-center p-4 ${className}`}>
      <div className={`animate-spin rounded-full border-b-2 border-blue-600 ${sizeClasses[size]}`} />
      
      <p className="text-sm text-gray-600 mt-2">{message}</p>
      
      {showProgress && (
        <div className="w-full max-w-xs mt-3">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1 text-center">{Math.round(progress)}%</p>
        </div>
      )}
      
      {showTimeoutWarning && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm max-w-xs">
          <p className="text-yellow-800 text-center">
            This is taking longer than expected. Please check your connection.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 w-full text-yellow-700 hover:text-yellow-900 underline text-xs"
          >
            Refresh page
          </button>
        </div>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white/80 z-50">
        {spinnerContent}
      </div>
    );
  }

  return spinnerContent;
};

export default LoadingSpinner;