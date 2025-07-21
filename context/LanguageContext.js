import React, { createContext, useState, useEffect, useContext } from 'react';
import { getPreferredLanguage, setPreferredLanguage, DEFAULT_LANGUAGE } from '../utils/languageUtils';
import { getTranslation } from '../utils/translations';
import { useTranslation } from 'react-i18next';
import i18n, { changeLanguage as changeI18nLanguage } from '../utils/i18n';

// Create language context
export const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState(DEFAULT_LANGUAGE);
  const [loading, setLoading] = useState(true);

  // Load saved language preference on app start
  useEffect(() => {
    const loadLanguagePreference = async () => {
      try {
        const savedLanguage = await getPreferredLanguage();
        setCurrentLanguage(savedLanguage);
      } catch (error) {
        console.error('Error loading language preference:', error);
      } finally {
        setLoading(false);
      }
    };

    loadLanguagePreference();
  }, []);

  // Function to change language
  const changeLanguage = async (language) => {
    try {
      await setPreferredLanguage(language);
      setCurrentLanguage(language);
      // Also change language in i18next
      await changeI18nLanguage(language);
      return true;
    } catch (error) {
      console.error('Error changing language:', error);
      return false;
    }
  };

  // Get i18next translation function
  const { t: i18nT } = useTranslation();
  
  // Translate function (maintains backward compatibility)
  const t = (key) => {
    // First try to get translation from i18next
    const i18nTranslation = i18nT(key, { lng: currentLanguage });
    
    // If the key is returned unchanged (not found), fall back to our custom implementation
    if (i18nTranslation === key) {
      return getTranslation(key, currentLanguage);
    }
    
    return i18nTranslation;
  };

  return (
    <LanguageContext.Provider
      value={{
        currentLanguage,
        changeLanguage,
        t,
        loading
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

// Custom hook to use language context
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};