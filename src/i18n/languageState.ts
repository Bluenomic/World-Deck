import { createContext } from "react";
import type { CardCategory } from "../types";
import { id } from "./translations/id";
export type Language = "id" | "en";

export type Translations = typeof id;

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
  getCategoryLabel: (cat: CardCategory) => string;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
);
