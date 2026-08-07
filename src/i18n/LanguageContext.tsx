import React, { createContext, useContext, useState, type ReactNode } from 'react';
import type { CardCategory } from '../types';
import { id } from './translations/id';
import { en } from './translations/en';

export type Language = 'id' | 'en';

export type Translations = typeof id;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
  getCategoryLabel: (cat: CardCategory) => string;
}

const STORAGE_LANG_KEY = 'worlddeck_language_v1';

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_LANG_KEY);
      if (saved === 'id' || saved === 'en') return saved;
    } catch (e) {}
    return 'id';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_LANG_KEY, lang);
    } catch (e) {}
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

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
