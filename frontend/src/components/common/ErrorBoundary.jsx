import React from 'react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { 
            error: null,
            errorInfo: null,
            hasError: false
        };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({
            error: error,
            errorInfo: errorInfo
        });

        // Log error to your error reporting service
        console.error('Error caught by boundary:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                    <div className="max-w-md w-full">
                        <Alert variant="destructive">
                            <AlertTitle className="text-lg font-semibold mb-2">
                                Something went wrong
                            </AlertTitle>
                            <AlertDescription>
                                <p className="text-sm mb-4">
                                    We're sorry, but there was an error loading this page.
                                    Please try refreshing or contact support if the problem persists.
                                </p>
                                <div className="flex justify-end space-x-2">
                                    <button
                                        onClick={() => window.location.reload()}
                                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 
                                                 transition-colors text-sm"
                                    >
                                        Refresh Page
                                    </button>
                                    <button
                                        onClick={() => window.location.href = '/'}
                                        className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 
                                                 transition-colors text-sm"
                                    >
                                        Go Home
                                    </button>
                                </div>
                                {process.env.NODE_ENV === 'development' && this.state.error && (
                                    <div className="mt-4 p-4 bg-gray-100 rounded text-sm overflow-auto">
                                        <pre className="text-red-600">
                                            {this.state.error.toString()}
                                        </pre>
                                        <pre className="text-gray-600 mt-2">
                                            {this.state.errorInfo?.componentStack}
                                        </pre>
                                    </div>
                                )}
                            </AlertDescription>
                        </Alert>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;