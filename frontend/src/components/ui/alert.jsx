// src/components/ui/alert.jsx
import React from 'react';

export const Alert = ({ children, variant = "default", className = "", ...props }) => {
  const variantClasses = {
    default: "bg-gray-100 text-gray-800",
    destructive: "bg-red-100 text-red-800",
    success: "bg-green-100 text-green-800",
    warning: "bg-yellow-100 text-yellow-800",
  };

  return (
    <div
      role="alert"
      className={`p-4 rounded-lg ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const AlertTitle = ({ children, className = "", ...props }) => {
  return (
    <h5
      className={`font-medium text-lg ${className}`}
      {...props}
    >
      {children}
    </h5>
  );
};

export const AlertDescription = ({ children, className = "", ...props }) => {
  return (
    <div
      className={`mt-2 text-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const AlertDialog = ({ children, className = "", ...props }) => {
  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 ${className}`}
      {...props}
    >
      <div className="bg-white p-6 rounded-lg max-w-md w-full">
        {children}
      </div>
    </div>
  );
};

export const AlertDialogAction = ({ children, className = "", ...props }) => {
  return (
    <button
      className={`px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Alert;