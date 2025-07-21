import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { translations } from './translations';
import { getPreferredLanguage, DEFAULT_LANGUAGE } from './languageUtils';

// Convert our existing translations format to i18next format
const resources = {};

Object.keys(translations).forEach(language => {
  resources[language] = {
    translation: translations[language]
  };
});

// Initialize i18next
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: DEFAULT_LANGUAGE,
    fallbackLng: 'English',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false,
    },
  });

// Function to change language
export const changeLanguage = async (language) => {
  try {
    await i18n.changeLanguage(language);
    return true;
  } catch (error) {
    console.error('Error changing i18n language:', error);
    return false;
  }
};

export default i18n;