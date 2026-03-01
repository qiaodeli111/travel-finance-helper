import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { Language, translations, TranslationKey } from './translations';
import { COUNTRIES, ORIGIN_COUNTRIES } from '../types';

const LANGUAGE_STORAGE_KEY = 'app_language';

// Context for global language state
interface TranslationContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  toggleLanguage: () => void;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

// Provider component
export const TranslationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null;
    if (stored && (stored === 'en' || stored === 'zh')) {
      return stored;
    }
    return 'en';
  });

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
  }, []);

  const t = useCallback((key: TranslationKey, params?: Record<string, string | number>): string => {
    let text = translations[language][key] || key;

    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
      });
    }

    return text;
  }, [language]);

  const toggleLanguage = useCallback(() => {
    setLanguageState(prev => prev === 'en' ? 'zh' : 'en');
  }, []);

  return (
    <TranslationContext.Provider value={{ language, setLanguage, t, toggleLanguage }}>
      {children}
    </TranslationContext.Provider>
  );
};

// Hook to use translation
export const useTranslation = () => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
};

export const getCategoryTranslation = (category: string, language: Language): string => {
  const categoryMap: Record<string, TranslationKey> = {
    '住宿': 'accommodation',
    '交通': 'transport',
    '餐饮': 'food',
    '娱乐': 'entertainment',
    '购物': 'shopping',
    '其他': 'other',
    'Accommodation': 'accommodation',
    'Transport': 'transport',
    'Food': 'food',
    'Entertainment': 'entertainment',
    'Shopping': 'shopping',
    'Other': 'other',
  };

  const key = categoryMap[category];
  if (key) {
    return translations[language][key];
  }
  return category;
};

export const getCountryTranslation = (countryName: string, language: Language): string => {
  // First, try to find in COUNTRIES
  const country = COUNTRIES.find(c => c.name === countryName);
  if (country) {
    return language === 'zh' ? country.name : country.nameEn;
  }

  // Then, try to find in ORIGIN_COUNTRIES
  const originCountry = ORIGIN_COUNTRIES.find(c => c.name === countryName);
  if (originCountry) {
    return language === 'zh' ? originCountry.name : originCountry.nameEn;
  }

  // Fallback: return the original name
  return countryName;
};

// Get currency label in the appropriate language
export const getCurrencyLabel = (countryName: string, language: Language): string => {
  // First, try to find in COUNTRIES
  const country = COUNTRIES.find(c => c.name === countryName);
  if (country) {
    return language === 'zh' ? country.label : country.labelEn;
  }

  // Then, try to find in ORIGIN_COUNTRIES
  const originCountry = ORIGIN_COUNTRIES.find(c => c.name === countryName);
  if (originCountry) {
    return language === 'zh' ? originCountry.label : originCountry.labelEn;
  }

  // Fallback: return the country name
  return countryName;
};

// Get country display text with currency info (for dropdowns)
export const getCountryDisplayText = (countryName: string, language: Language, includeCurrency: boolean = true): string => {
  const country = COUNTRIES.find(c => c.name === countryName);
  if (country) {
    const name = language === 'zh' ? country.name : country.nameEn;
    if (includeCurrency) {
      return `${name} (${country.currency})`;
    }
    return name;
  }

  const originCountry = ORIGIN_COUNTRIES.find(c => c.name === countryName);
  if (originCountry) {
    const name = language === 'zh' ? originCountry.name : originCountry.nameEn;
    const label = language === 'zh' ? originCountry.label : originCountry.labelEn;
    if (includeCurrency) {
      return `${name} (${originCountry.currency} - ${label})`;
    }
    return name;
  }

  return countryName;
};