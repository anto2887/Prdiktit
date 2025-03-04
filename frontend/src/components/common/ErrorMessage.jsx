import React from 'react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

const ErrorMessage = ({ 
    title,
    message,
    retry = null,
    className = ''
}) => {
    return (
        <Alert 
            variant="destructive" 
            className={`max-w-md mx-auto ${className}`}
        >
            <AlertCircle className="h-4 w-4" />
            {title && <AlertTitle>{title}</AlertTitle>}
            <AlertDescription className="mt-1">
                {message}
                {retry && (
                    <button
                        onClick={retry}
                        className="block mt-2 text-sm underline hover:no-underline"
                    >
                        Try again
                    </button>
                )}
            </AlertDescription>
        </Alert>
    );
};

export default ErrorMessage;