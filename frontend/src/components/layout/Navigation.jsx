// src/components/layout/Navigation.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, useNotifications } from '../../contexts/AppContext';
import { useI18n } from '../../i18n';
import { resolvePageTourKey, useTour } from '../../contexts/TourContext';

const LOCALE_OPTIONS = [
  { value: 'en', flag: '🇺🇸', labelKey: 'common.english' },
  { value: 'fr', flag: '🇫🇷', labelKey: 'common.french' },
  { value: 'es', flag: '🇲🇽', labelKey: 'common.spanish' },
  { value: 'pt', flag: '🇧🇷', labelKey: 'common.portuguese' },
];

const Navigation = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const { showSuccess, showInfo } = useNotifications();
  const { locale, setLocale, t } = useI18n();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { startTour, startTourAfterNavigation } = useTour();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const helpRef = useRef(null);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const langRef = useRef(null);

  const handleLogout = async () => {
    try {
      await logout();
      showSuccess('Successfully logged out');
      setIsDropdownOpen(false);
      navigate('/login');
    } catch (error) {
      process.env.NODE_ENV === 'development' && console.error('Logout failed:', error);
      navigate('/login');
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (helpRef.current && !helpRef.current.contains(event.target)) {
        setIsHelpOpen(false);
      }
      if (langRef.current && !langRef.current.contains(event.target)) {
        setIsLangOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const runDashboardTour = () => {
    setIsHelpOpen(false);
    if (pathname === '/dashboard') {
      const ok = startTour('dashboard');
      if (!ok) showInfo(t('help.noTourThisPage'));
    } else {
      startTourAfterNavigation('dashboard', '/dashboard');
    }
  };

  const runThisPageTour = () => {
    setIsHelpOpen(false);
    const key = resolvePageTourKey(pathname);
    if (!key) {
      showInfo(t('help.noTourThisPage'));
      return;
    }
    const ok = startTour(key);
    if (!ok) showInfo(t('help.noTourThisPage'));
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const currentLocaleOption =
    LOCALE_OPTIONS.find((o) => o.value === locale) || LOCALE_OPTIONS[0];

  const renderLanguageMenu = (buttonClassName) => (
    <div className="relative" ref={langRef}>
      <button
        type="button"
        onClick={() => {
          setIsLangOpen((o) => !o);
          setIsHelpOpen(false);
        }}
        className={buttonClassName}
        aria-expanded={isLangOpen}
        aria-haspopup="listbox"
        aria-label={t('nav.selectLanguage')}
      >
        <span className="text-lg leading-none" aria-hidden>
          {currentLocaleOption.flag}
        </span>
      </button>
      {isLangOpen && (
        <ul
          role="listbox"
          className="absolute right-0 mt-2 w-52 rounded-md shadow-lg py-1 bg-white dark:bg-gray-800 ring-1 ring-black dark:ring-gray-700 ring-opacity-5 z-50"
        >
          {LOCALE_OPTIONS.map((o) => (
            <li key={o.value} role="option" aria-selected={locale === o.value}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => {
                  setLocale(o.value);
                  setIsLangOpen(false);
                }}
              >
                <span className="text-lg" aria-hidden>
                  {o.flag}
                </span>
                <span>{t(o.labelKey)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <img
                className="h-8 w-auto"
                src="/static/images/logo.svg"
                alt="Football Predictions"
              />
              <span className="ml-2 text-xl font-bold text-blue-600 dark:text-blue-400">
                PrediktIt
              </span>
            </Link>
          </div>

          <div className="flex items-center">
            {isAuthenticated ? (
              <div className="flex items-center space-x-3 sm:space-x-4">
                <span className="text-gray-700 dark:text-gray-200 hidden sm:inline max-w-[10rem] truncate">
                  {user?.username}
                </span>
                {renderLanguageMenu(
                  'px-2 py-1.5 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
                )}
                <div className="relative" ref={helpRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsHelpOpen((o) => !o);
                      setIsLangOpen(false);
                    }}
                    className="px-3 py-1.5 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-expanded={isHelpOpen}
                    aria-haspopup="true"
                    aria-label={t('help.menuAria')}
                  >
                    {t('help.help')}
                  </button>
                  {isHelpOpen && (
                    <div
                      className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg py-1 bg-white dark:bg-gray-800 ring-1 ring-black dark:ring-gray-700 ring-opacity-5 z-50"
                      role="menu"
                    >
                      <button
                        type="button"
                        onClick={runDashboardTour}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                        role="menuitem"
                      >
                        {t('help.menuDashboard')}
                      </button>
                      <button
                        type="button"
                        onClick={runThisPageTour}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                        role="menuitem"
                      >
                        {t('help.menuThisPage')}
                      </button>
                    </div>
                  )}
                </div>
                <div className="relative" ref={dropdownRef}>
                  <div>
                    <button
                      type="button"
                      onClick={toggleDropdown}
                      className="bg-white dark:bg-gray-800 rounded-full flex text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
                      id="user-menu-button"
                      aria-expanded={isDropdownOpen}
                      aria-haspopup="true"
                    >
                      <span className="sr-only">Open user menu</span>
                      <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                        <span className="text-blue-600 dark:text-blue-300 font-medium">
                          {user?.username?.charAt(0).toUpperCase() || 'U'}
                        </span>
                      </div>
                    </button>
                  </div>

                  {isDropdownOpen && (
                    <div
                      className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white dark:bg-gray-800 ring-1 ring-black dark:ring-gray-700 ring-opacity-5 dark:ring-opacity-10 focus:outline-none z-50"
                      role="menu"
                      aria-orientation="vertical"
                      aria-labelledby="user-menu-button"
                      tabIndex="-1"
                    >
                      <Link
                        to="/profile"
                        onClick={() => setIsDropdownOpen(false)}
                        className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                        role="menuitem"
                      >
                        {t('nav.yourProfile')}
                      </Link>
                      <Link
                        to="/settings"
                        onClick={() => setIsDropdownOpen(false)}
                        className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                        role="menuitem"
                      >
                        {t('nav.settings')}
                      </Link>
                      <Link
                        to="/groups"
                        onClick={() => setIsDropdownOpen(false)}
                        className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                        role="menuitem"
                      >
                        {t('nav.myLeagues')}
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                        role="menuitem"
                      >
                        {t('nav.signOut')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                {renderLanguageMenu(
                  'px-2 py-1.5 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
                )}
                <Link
                  to="/login"
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
                >
                  {t('nav.signIn')}
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
                >
                  {t('nav.signUp')}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
