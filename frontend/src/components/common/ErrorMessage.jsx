import React, { useState } from 'react';

const ErrorMessage = ({ 
  message = "An error occurred", 
  title = "Error",
  onRetry = null,
  showDetails = false,
  error = null,
  className = "",
  variant = "error" // "error", "warning", "info"
}) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  
  const variantStyles = {
    error: {
      container: "bg-red-50 border-red-200 text-red-800",
      icon: "text-red-400",
      button: "bg-red-600 hover:bg-red-700 text-white"
    },
    warning: {
      container: "bg-yellow-50 border-yellow-200 text-yellow-800", 
      icon: "text-yellow-400",
      button: "bg-yellow-600 hover:bg-yellow-700 text-white"
    },
    info: {
      container: "bg-blue-50 border-blue-200 text-blue-800",
      icon: "text-blue-400", 
      button: "bg-blue-600 hover:bg-blue-700 text-white"
    }
  };
  
  const styles = variantStyles[variant] || variantStyles.error;
  
  return (
    <div className={`border rounded-lg p-4 ${styles.container} ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className={`w-5 h-5 ${styles.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="text-sm mt-1">{message}</p>
          
          {onRetry && (
            <div className="mt-3">
              <button
                onClick={onRetry}
                className={`px-3 py-1 rounded text-sm transition-colors ${styles.button}`}
              >
                Try Again
              </button>
            </div>
          )}
          
          {showDetails && error && process.env.NODE_ENV === 'development' && (
            <div className="mt-3">
              <button
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                className="text-sm hover:underline"
              >
                {showTechnicalDetails ? 'Hide' : 'Show'} Technical Details
              </button>
              
              {showTechnicalDetails && (
                <pre className="mt-2 text-xs bg-white bg-opacity-50 p-2 rounded overflow-auto border max-h-40">
                  {error.stack || error.message || JSON.stringify(error, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorMessage;