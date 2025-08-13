import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiConfig, getEndpoint, logApiCall, logApiResponse } from '../config/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [guestSession, setGuestSession] = useState(null);

  useEffect(() => {
    checkExistingAuth();
  }, []);

  const checkExistingAuth = async () => {
    try {
      // Clear any existing auth for demo purposes (force login screen)
      await AsyncStorage.removeItem('verveq_token');
      setToken(null);
      setUser(null);
    } catch (error) {
      console.warn('Failed to clear auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentUser = async (authToken = token) => {
    if (!authToken) return null;

    try {
      const url = getEndpoint('auth', 'me');
      logApiCall('GET', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        logApiResponse('GET', url, userData);
        setUser(userData);
        return userData;
      } else {
        // Token invalid, clear auth
        logApiResponse('GET', url, null, 'Token invalid');
        await logout();
      }
    } catch (error) {
      logApiResponse('GET', getEndpoint('auth', 'me'), null, error);
      console.warn('Failed to get current user:', error);
    }
    return null;
  };

  const login = async (displayName, email = null, avatarUrl = null) => {
    try {
      const url = getEndpoint('auth', 'login');
      const requestData = {
        display_name: displayName,
        email,
        avatar_url: avatarUrl,
      };
      
      logApiCall('POST', url, requestData);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (response.ok) {
        const data = await response.json();
        const { access_token, user: userData } = data;
        
        logApiResponse('POST', url, { user: userData });
        
        // Store token
        await AsyncStorage.setItem('verveq_token', access_token);
        setToken(access_token);
        setUser(userData);

        return { success: true, user: userData };
      } else {
        const error = await response.json();
        logApiResponse('POST', url, null, error);
        
        // Provide more descriptive error messages
        let errorMessage = 'Authentication failed';
        if (response.status === 400) {
          errorMessage = 'Invalid input. Please check your information and try again.';
        } else if (response.status === 429) {
          errorMessage = 'Too many login attempts. Please wait a moment and try again.';
        } else if (response.status >= 500) {
          errorMessage = 'Server error. Please try again in a moment.';
        } else if (error.detail) {
          errorMessage = error.detail;
        }
        
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      logApiResponse('POST', getEndpoint('auth', 'login'), null, error);
      console.error('Login failed:', error);
      
      // Provide more descriptive network error messages
      let errorMessage = 'Network error';
      if (error.name === 'TypeError' && error.message.includes('Network request failed')) {
        errorMessage = 'Unable to connect to server. Please check your internet connection.';
      } else if (error.name === 'AbortError') {
        errorMessage = 'Request timeout. Please try again.';
      } else if (error.message.includes('fetch')) {
        errorMessage = 'Connection failed. Please check your internet and try again.';
      }
      
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('verveq_token');
      setToken(null);
      setUser(null);
    } catch (error) {
      console.warn('Failed to logout:', error);
    }
  };

  const updateUserStats = async () => {
    // Refresh user data to get updated stats
    await getCurrentUser();
  };

  const createGuestSession = async () => {
    try {
      const url = getEndpoint('auth', 'guestSession');
      logApiCall('POST', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        logApiResponse('POST', url, data);
        setGuestSession(data.session_id);
        return { success: true, sessionId: data.session_id };
      }
      logApiResponse('POST', url, null, 'Failed to create guest session');
      return { success: false, error: 'Failed to create guest session' };
    } catch (error) {
      logApiResponse('POST', getEndpoint('auth', 'guestSession'), null, error);
      console.error('Guest session creation failed:', error);
      return { success: false, error: 'Network error' };
    }
  };

  const apiCall = async (endpoint, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Build full URL
    const url = endpoint.startsWith('http') ? endpoint : `${apiConfig.baseURL}${endpoint}`;
    logApiCall(options.method || 'GET', url, options.body);

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Token expired, logout
      logApiResponse(options.method || 'GET', url, null, 'Authentication expired');
      await logout();
      throw new Error('Authentication expired');
    }

    return response;
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      guestSession,
      login,
      logout,
      updateUserStats,
      createGuestSession,
      apiCall,
      isAuthenticated: !!user,
      isGuest: !!guestSession,
    }}>
      {children}
    </AuthContext.Provider>
  );
};