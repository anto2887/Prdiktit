import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingSpinner = ({ 
    size = 'default',
    fullScreen = false,
    className = ''
}) => {
    const sizeClasses = {
        small: 'w-4 h-4',
        default: 'w-8 h-8',
        large: 'w-12 h-12'
    };

    const spinnerContent = (
        <Loader2 
            className={`animate-spin ${sizeClasses[size]} ${className}`}
        />
    );

    if (fullScreen) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-white/80 z-50">
                {spinnerContent}
            </div>
        );
    }

    return (
        <div className="flex justify-center items-center p-4">
            {spinnerContent}
        </div>
    );
};

export default LoadingSpinner;