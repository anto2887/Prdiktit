import React, { createContext, useContext, useMemo, useState } from 'react';
import en from '../locales/en.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import pt from '../locales/pt.json';

const STORAGE_KEY = 'app_locale';
const FALLBACK_LOCALE = 'en';
const LOCALES = { en, es, fr, pt };

const detectLocale = () => {
  if (typeof window === 'undefined') return FALLBACK_LOCALE;
  const language = (window.navigator?.language || '').toLowerCase();
  if (language.startsWith('pt-br') || language.startsWith('pt-pt') || language.startsWith('pt')) {
    return 'pt';
  }
  if (language.startsWith('es')) return 'es';
  if (language.startsWith('fr')) return 'fr';
  return FALLBACK_LOCALE;
};

const I18nContext = createContext({
  locale: FALLBACK_LOCALE,
  setLocale: () => {},
  t: (key) => key,
});

export const I18nProvider = ({ children }) => {
  const [locale, setLocaleState] = useState(() => {
    if (typeof window === 'undefined') return FALLBACK_LOCALE;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored && LOCALES[stored] ? stored : detectLocale();
  });

  const setLocale = (nextLocale) => {
    const safe = LOCALES[nextLocale] ? nextLocale : FALLBACK_LOCALE;
    setLocaleState(safe);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, safe);
    }
  };

  const value = useMemo(() => {
    const dict = LOCALES[locale] || LOCALES[FALLBACK_LOCALE];
    return {
      locale,
      setLocale,
      t: (key) => dict[key] || LOCALES[FALLBACK_LOCALE][key] || key,
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => useContext(I18nContext);
