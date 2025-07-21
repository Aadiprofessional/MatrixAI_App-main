import AsyncStorage from '@react-native-async-storage/async-storage';

// Available languages in the app
export const LANGUAGES = {
  English: {
    code: 'en',
    name: 'English'
  },
  'Traditional Chinese': {
    code: 'zh-Hant',
    name: '繁體中文'
  },
  'Simplified Chinese': {
    code: 'zh-Hans',
    name: '简体中文'
  }
};

export const DEFAULT_LANGUAGE = 'English';

// Key for storing language preference in AsyncStorage
const LANGUAGE_STORAGE_KEY = 'preferred_language';

// Get the user's preferred language
export const getPreferredLanguage = async () => {
  try {
    const language = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    return language || DEFAULT_LANGUAGE;
  } catch (error) {
    console.error('Error getting preferred language:', error);
    return DEFAULT_LANGUAGE;
  }
};

// Set the user's preferred language
export const setPreferredLanguage = async (language) => {
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    return true;
  } catch (error) {
    console.error('Error setting preferred language:', error);
    return false;
  }
};

// Clear language preference (used on logout)
export const clearLanguagePreference = async () => {
  try {
    await AsyncStorage.removeItem(LANGUAGE_STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('Error clearing language preference:', error);
    return false;
  }
}; 