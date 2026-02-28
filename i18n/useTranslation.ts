import { useState, useEffect, useCallback } from 'react';
import { Language, translations, TranslationKey } from './translations';

const LANGUAGE_STORAGE_KEY = 'app_language';

export const useTranslation = (initialLanguage?: Language) => {
  const [language, setLanguage] = useState<Language>(() => {
    // Try to get from storage first
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null;
    if (stored && (stored === 'en' || stored === 'zh')) {
      return stored;
    }
    return initialLanguage || 'en';
  });

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    // Update HTML lang attribute
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  }, [language]);

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
    setLanguage(prev => prev === 'en' ? 'zh' : 'en');
  }, []);

  return { t, language, setLanguage, toggleLanguage };
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
  const countryMap: Record<string, string> = {
    '阿根廷': 'argentina',
    '阿联酋': 'uae',
    '埃及': 'egypt',
    '澳大利亚': 'australia',
    '巴西': 'brazil',
    '俄罗斯': 'russia',
    '菲律宾': 'philippines',
    '韩国': 'korea',
    '加拿大': 'canada',
    '柬埔寨': 'cambodia',
    '老挝': 'laos',
    '马尔代夫': 'maldives',
    '马来西亚': 'malaysia',
    '美国': 'usa',
    '缅甸': 'myanmar',
    '墨西哥': 'mexico',
    '南非': 'southAfrica',
    '尼泊尔': 'nepal',
    '欧洲': 'europe',
    '日本': 'japan',
    '瑞士': 'switzerland',
    '斯里兰卡': 'sriLanka',
    '泰国': 'thailand',
    '土耳其': 'turkey',
    '新加坡': 'singapore',
    '新西兰': 'newZealand',
    '印度': 'india',
    '印度尼西亚': 'indonesia',
    '英国': 'uk',
    '越南': 'vietnam',
    '中国澳门': 'macau',
    '中国香港': 'hongKong',
  };

  const key = countryMap[countryName];
  if (key) {
    return translations[language].countries[key as keyof typeof translations.en.countries];
  }
  return countryName;
};