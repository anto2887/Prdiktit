/**
 * Theme utility functions
 * Manages theme state and applies it to the DOM
 */

/**
 * Get system theme preference
 * @returns {string} 'light' or 'dark'
 */
export const getSystemTheme = () => {
  if (typeof window === 'undefined') return 'light';
  
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

/**
 * Get effective theme (resolves 'system' to actual theme)
 * @param {string} theme - Theme preference ('light', 'dark', or 'system')
 * @returns {string} 'light' or 'dark'
 */
export const getEffectiveTheme = (theme) => {
  if (theme === 'system') {
    return getSystemTheme();
  }
  return theme === 'dark' ? 'dark' : 'light';
};

/**
 * Apply theme to the DOM
 * @param {string} theme - Theme to apply ('light', 'dark', or 'system')
 */
export const applyTheme = (theme) => {
  if (typeof document === 'undefined') return;
  
  const effectiveTheme = getEffectiveTheme(theme);
  const html = document.documentElement;
  
  if (effectiveTheme === 'dark') {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
  
  // Store theme preference in localStorage for persistence across sessions
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('theme', theme);
  }
};

/**
 * Get saved theme from localStorage
 * @returns {string|null} Saved theme or null
 */
export const getSavedTheme = () => {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem('theme');
};

/**
 * Initialize theme on app load
 * @param {string} savedTheme - Theme from user profile settings
 * @returns {string} Theme to use
 */
export const initializeTheme = (savedTheme = null) => {
  // Priority: savedTheme (from profile) > localStorage > system
  const theme = savedTheme || getSavedTheme() || 'system';
  applyTheme(theme);
  return theme;
};

/**
 * Listen for system theme changes (for 'system' theme mode)
 * @param {function} callback - Callback function when system theme changes
 * @returns {function} Cleanup function
 */
export const watchSystemTheme = (callback) => {
  if (typeof window === 'undefined') return () => {};
  
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  
  const handleChange = (e) => {
    callback(e.matches ? 'dark' : 'light');
  };
  
  // Modern browsers
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }
  // Legacy browsers
  else if (mediaQuery.addListener) {
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }
  
  return () => {};
};
