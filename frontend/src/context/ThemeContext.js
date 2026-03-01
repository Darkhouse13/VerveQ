import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { lightTheme, darkTheme, createStyles } from '../design/theme';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [theme, setTheme] = useState(lightTheme);
  const [styles, setStyles] = useState(createStyles(lightTheme));

  useEffect(() => {
    loadThemePreference();
    
    // Listen to system theme changes
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      handleSystemThemeChange(colorScheme);
    });

    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    // Update theme and styles when mode changes
    const newTheme = isDarkMode ? darkTheme : lightTheme;
    setTheme(newTheme);
    setStyles(createStyles(newTheme));
  }, [isDarkMode]);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('verveq_theme_preference');
      
      if (savedTheme) {
        // User has explicitly chosen a theme
        const isDark = savedTheme === 'dark';
        setIsDarkMode(isDark);
      } else {
        // Follow system preference
        const systemColorScheme = Appearance.getColorScheme();
        setIsDarkMode(systemColorScheme === 'dark');
      }
    } catch (error) {
      console.warn('Failed to load theme preference:', error);
      // Fallback to system preference
      const systemColorScheme = Appearance.getColorScheme();
      setIsDarkMode(systemColorScheme === 'dark');
    }
  };

  const handleSystemThemeChange = async (colorScheme) => {
    try {
      const savedTheme = await AsyncStorage.getItem('verveq_theme_preference');
      
      // Only update if user hasn't explicitly set a preference
      if (!savedTheme) {
        setIsDarkMode(colorScheme === 'dark');
      }
    } catch (error) {
      console.warn('Failed to handle system theme change:', error);
    }
  };

  const toggleTheme = async () => {
    try {
      const newIsDarkMode = !isDarkMode;
      setIsDarkMode(newIsDarkMode);
      
      // Save user's explicit preference
      await AsyncStorage.setItem(
        'verveq_theme_preference', 
        newIsDarkMode ? 'dark' : 'light'
      );
    } catch (error) {
      console.warn('Failed to save theme preference:', error);
    }
  };

  const setThemeMode = async (mode) => {
    try {
      const newIsDarkMode = mode === 'dark';
      setIsDarkMode(newIsDarkMode);
      
      // Save user's explicit preference
      await AsyncStorage.setItem('verveq_theme_preference', mode);
    } catch (error) {
      console.warn('Failed to save theme preference:', error);
    }
  };

  const resetToSystemTheme = async () => {
    try {
      // Remove saved preference
      await AsyncStorage.removeItem('verveq_theme_preference');
      
      // Follow system preference
      const systemColorScheme = Appearance.getColorScheme();
      setIsDarkMode(systemColorScheme === 'dark');
    } catch (error) {
      console.warn('Failed to reset to system theme:', error);
    }
  };

  const value = {
    theme,
    styles,
    isDarkMode,
    toggleTheme,
    setThemeMode,
    resetToSystemTheme
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};