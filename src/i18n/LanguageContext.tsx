import type { CardCategory } from '../types';
import React, { useState, type ReactNode } from 'react';
import { id } from './translations/id';
import { en } from './translations/en';

import { LanguageContext, type Language } from './languageState';
const STORAGE_LANG_KEY = 'worlddeck_language_v1';

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_LANG_KEY);
      if (saved === 'id' || saved === 'en') return saved;
    } catch {}
    return 'id';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_LANG_KEY, lang);
    } catch {}
  };

  const t = language === 'en' ? en : id;

  const getCategoryLabel = (cat: CardCategory): string => {
    return t.categories[cat] || cat;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, getCategoryLabel }}>
      {children}
    </LanguageContext.Provider>
  );
};
