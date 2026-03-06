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
 * @param {boolean} persistToLocalStorage - Whether to save to localStorage (default: false)
 *                                          Only used for initial FOUC prevention
 */
export const applyTheme = (theme, persistToLocalStorage = false) => {
  if (typeof document === 'undefined') return;
  
  const effectiveTheme = getEffectiveTheme(theme);
  const html = document.documentElement;
  
  if (effectiveTheme === 'dark') {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
  
  // Only persist to localStorage if explicitly requested (for initial FOUC prevention)
  // Profile settings are the source of truth, not localStorage
  if (persistToLocalStorage && typeof localStorage !== 'undefined') {
    localStorage.setItem('theme', theme);
  }
};

/**
 * Get saved theme from localStorage (only for initial FOUC prevention)
 * @returns {string|null} Saved theme or null
 */
export const getSavedTheme = () => {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem('theme');
};

/**
 * Clear theme from localStorage (after profile loads)
 */
export const clearSavedTheme = () => {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('theme');
  }
};

/**
 * Initialize theme on app load
 * @param {string} savedTheme - Theme from user profile settings (source of truth)
 * @param {boolean} isInitialLoad - Whether this is the initial page load (before profile loads)
 * @returns {string} Theme to use
 */
export const initializeTheme = (savedTheme = null, isInitialLoad = false) => {
  let theme;
  
  if (savedTheme) {
    // Profile settings are the source of truth - always use them when available
    theme = savedTheme;
  } else if (isInitialLoad) {
    // Only use localStorage on initial load to prevent FOUC (Flash of Unstyled Content)
    // This is a temporary fallback until profile loads
    theme = getSavedTheme() || 'system';
  } else {
    // If no profile theme and not initial load, use system default
    theme = 'system';
  }
  
  // Only persist to localStorage on initial load (to prevent FOUC on refresh)
  applyTheme(theme, isInitialLoad);
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
