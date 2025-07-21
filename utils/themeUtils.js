import AsyncStorage from '@react-native-async-storage/async-storage';

// Define theme constants
export const THEMES = {
  light: {
    name: 'Light',
    colors: {
      background: '#FFFFFF',
      background2: '#FFFFFF',
      text: '#333333',
      botText: '#333333',
      primary: '#007AFF',
      secondary: '#5856D6',
      card: '#FFFFFF',
      border: '#E0E0E0',
      notification: '#FF3B30',
      placeholder: '#CCCCCC',
      disabled: '#F0F0F0',
      subtle: '#F7F7F7'
    }
  },
  dark: {
    name: 'Dark',
    colors: {
      background: '#1C1C1E',
      background2: '#1C1C1E',
      text: '#FFFFFF',
      botText: '#FFFFFF',
      primary: '#0A84FF',
      secondary: '#5E5CE6',
      card: '#2C2C2E',
      border: '#3A3A3C',
      notification: '#FF453A',
      placeholder: '#8E8E93',
      disabled: '#3A3A3C',
      subtle: '#2C2C2E'
    }
  },
  gray: {
    name: 'Gray',
    colors: {
      background: '#F2F2F7',
      background2: '#F2F2F7',
      text: '#1C1C1E',
      botText: '#1C1C1E',
      primary: '#007AFF',
      secondary: '#5856D6',
      card: '#E5E5EA',
      border: '#C7C7CC',
      notification: '#FF3B30',
      placeholder: '#8E8E93',
      disabled: '#D1D1D6',
      subtle: '#E5E5EA'
    }
  }
};

// Default theme
export const DEFAULT_THEME = 'dark';

// Key for storing theme preference in AsyncStorage
const THEME_STORAGE_KEY = 'preferred_theme';

// Get the user's preferred theme
export const getPreferredTheme = async () => {
  try {
    const theme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
    return theme || DEFAULT_THEME;
  } catch (error) {
    console.error('Error getting preferred theme:', error);
    return DEFAULT_THEME;
  }
};

// Set the user's preferred theme
export const setPreferredTheme = async (theme) => {
  try {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, theme);
    return true;
  } catch (error) {
    console.error('Error setting preferred theme:', error);
    return false;
  }
};

// Clear theme preference (used on logout)
export const clearThemePreference = async () => {
  try {
    await AsyncStorage.removeItem(THEME_STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('Error clearing theme preference:', error);
    return false;
  }
};

// Get appropriate status bar style based on theme
export const getStatusBarStyle = (theme) => {
  if (theme === 'dark') {
    return 'light-content'; // Light text for dark backgrounds
  } else {
    return 'dark-content'; // Dark text for light backgrounds
  }
}; 