import React, { createContext, useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { StatusBar, Platform } from 'react-native';
import { getPreferredTheme, setPreferredTheme, DEFAULT_THEME, THEMES, getStatusBarStyle } from '../utils/themeUtils';

// Create theme context
export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState(DEFAULT_THEME);
  const [loading, setLoading] = useState(true);

  // Load saved theme preference on app start
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedTheme = await getPreferredTheme();
        setCurrentTheme(savedTheme);
      } catch (error) {
        console.error('Error loading theme preference:', error);
      } finally {
        setLoading(false);
      }
    };

    loadThemePreference();
  }, []);

  // Update StatusBar when theme changes
  useEffect(() => {
    if (!loading) {
      // Apply the correct status bar style based on theme with no animation
      StatusBar.setBarStyle(getStatusBarStyle(currentTheme), true);
    }
  }, [currentTheme, loading]);

  // Function to change theme
  const changeTheme = useCallback(async (theme) => {
    try {
      // Set the StatusBar style immediately before state changes
      StatusBar.setBarStyle(getStatusBarStyle(theme), true);
      
      await setPreferredTheme(theme);
      setCurrentTheme(theme);
      return true;
    } catch (error) {
      console.error('Error changing theme:', error);
      return false;
    }
  }, []);

  // Get current theme colors
  const getThemeColors = useCallback(() => {
    return THEMES[currentTheme].colors;
  }, [currentTheme]);

  // Get current status bar style based on theme
  const getCurrentStatusBarStyle = useCallback(() => {
    return getStatusBarStyle(currentTheme);
  }, [currentTheme]);

  const value = useMemo(() => ({
    currentTheme,
    changeTheme,
    getThemeColors,
    loading,
    themes: THEMES,
    statusBarStyle: getCurrentStatusBarStyle()
  }), [currentTheme, changeTheme, getThemeColors, loading, getCurrentStatusBarStyle]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook to use theme context
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};