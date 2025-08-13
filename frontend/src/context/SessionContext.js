import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiConfig, logApiCall, logApiResponse } from '../config/api';

const SessionContext = createContext();

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};

export const SessionProvider = ({ children }) => {
  const [sessionId, setSessionId] = useState(null);
  const [currentTheme, setCurrentTheme] = useState({
    primary_color: '#1a237e',
    secondary_color: '#4caf50', 
    accent_color: '#ff9800',
    background_color: '#f5f5f5',
    text_color: '#333333',
    icon: '🏆',
    display_name: 'VerveQ'
  });
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => {
    initializeSession();
  }, []);

  const initializeSession = async () => {
    try {
      // Try to get existing session from storage
      const storedSessionId = await AsyncStorage.getItem('verveq_session_id');
      
      // Create or retrieve session from API
      const url = `${apiConfig.baseURL}/session`;
      const requestData = { session_id: storedSessionId };
      logApiCall('POST', url, requestData);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();
      logApiResponse('POST', url, data);
      
      setSessionId(data.session_id);
      
      // Store session ID for future use
      await AsyncStorage.setItem('verveq_session_id', data.session_id);
      
      // Load dashboard data
      await loadDashboard(data.session_id);
      
    } catch (error) {
      logApiResponse('POST', `${apiConfig.baseURL}/session`, null, error);
      console.warn('Failed to initialize session:', error);
      // Continue without session - app still works
    }
  };

  const loadDashboard = async (sessionIdToUse = sessionId) => {
    if (!sessionIdToUse) return;
    
    try {
      const url = `${apiConfig.baseURL}/session/${sessionIdToUse}/dashboard`;
      logApiCall('GET', url);
      
      const response = await fetch(url);
      const data = await response.json();
      logApiResponse('GET', url, data);
      setDashboard(data);
    } catch (error) {
      logApiResponse('GET', `${apiConfig.baseURL}/session/${sessionIdToUse}/dashboard`, null, error);
      console.warn('Failed to load dashboard:', error);
    }
  };

  const updateScore = async (sport, mode, score, total = null) => {
    if (!sessionId) return;
    
    try {
      const url = `${apiConfig.baseURL}/session/${sessionId}/score`;
      const requestData = { sport, mode, score, total };
      logApiCall('POST', url, requestData);
      
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });
      
      logApiResponse('POST', url, 'Success');
      
      // Reload dashboard to get updated scores
      await loadDashboard();
      
    } catch (error) {
      logApiResponse('POST', `${apiConfig.baseURL}/session/${sessionId}/score`, null, error);
      console.warn('Failed to update score:', error);
    }
  };

  const loadSportTheme = async (sport) => {
    try {
      const url = `${apiConfig.baseURL}/sports/${sport}/theme`;
      logApiCall('GET', url);
      
      const response = await fetch(url);
      const theme = await response.json();
      logApiResponse('GET', url, theme);
      setCurrentTheme(theme);
      return theme;
    } catch (error) {
      logApiResponse('GET', `${apiConfig.baseURL}/sports/${sport}/theme`, null, error);
      console.warn('Failed to load sport theme:', error);
      return currentTheme;
    }
  };

  const resetTheme = () => {
    setCurrentTheme({
      primary_color: '#1a237e',
      secondary_color: '#4caf50', 
      accent_color: '#ff9800',
      background_color: '#f5f5f5',
      text_color: '#333333',
      icon: '🏆',
      display_name: 'VerveQ'
    });
  };

  return (
    <SessionContext.Provider value={{
      sessionId,
      currentTheme,
      dashboard,
      updateScore,
      loadSportTheme,
      resetTheme,
      loadDashboard,
    }}>
      {children}
    </SessionContext.Provider>
  );
};