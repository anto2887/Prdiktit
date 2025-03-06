// src/contexts/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        // Check authentication status on mount
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            setLoading(true);
            console.log("Checking authentication...");
            
            // First check if we have a token
            const hasToken = authApi.isAuthenticated();
            console.log("Has token:", hasToken);
            
            if (!hasToken) {
                console.log("No token found, setting unauthenticated");
                setIsAuthenticated(false);
                setUser(null);
                setLoading(false);
                return;
            }
            
            // Verify token with the server
            console.log("Verifying token with server...");
            try {
                const response = await authApi.checkAuthStatus();
                console.log("Auth check response:", response);
                
                if (response && response.status === 'success' && response.data?.authenticated) {
                    console.log("Token valid, setting authenticated");
                    setUser(response.data.user);
                    setIsAuthenticated(true);
                } else {
                    console.log("Token invalid, clearing");
                    setUser(null);
                    setIsAuthenticated(false);
                    // Clear invalid token
                    localStorage.removeItem('accessToken');
                }
            } catch (checkErr) {
                console.error("Error checking auth status:", checkErr);
                setUser(null);
                setIsAuthenticated(false);
                // Clear invalid token
                localStorage.removeItem('accessToken');
            }
        } catch (err) {
            console.error('Auth check failed:', err);
            setUser(null);
            setIsAuthenticated(false);
            setError(err.message || 'Authentication check failed');
            // Clear invalid token
            localStorage.removeItem('accessToken');
        } finally {
            setLoading(false);
        }
    };

    const login = async (username, password) => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await authApi.login(username, password);
            
            if (response.status === 'success') {
                setUser(response.data.user);
                setIsAuthenticated(true);
                return response;
            }
            
            throw new Error(response.message || 'Login failed');
        } catch (err) {
            setError(err.message || 'Login failed');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const register = async (userData) => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await authApi.register(userData);
            
            if (response.status === 'success') {
                return response;
            }
            
            throw new Error(response.message || 'Registration failed');
        } catch (err) {
            setError(err.message || 'Registration failed');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        try {
            setLoading(true);
            await authApi.logout();
            
            setUser(null);
            setIsAuthenticated(false);
        } catch (err) {
            console.error('Logout error:', err);
            // Still clear user data even if logout fails on server
            setUser(null);
            setIsAuthenticated(false);
        } finally {
            setLoading(false);
        }
    };

    const clearError = () => {
        setError(null);
    };

    const contextValue = {
        user,
        loading,
        error,
        isAuthenticated,
        login,
        register,
        logout,
        checkAuth,
        clearError
    };

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export default AuthContext;