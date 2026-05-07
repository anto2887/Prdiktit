/**
 * Theme utility functions
 * Manages theme state and applies it to the DOM
 * System theme is now a distinct blue-tinted theme, not OS preference
 */

/**
 * Apply theme to the DOM
 * @param {string} theme - Theme to apply ('light', 'dark', or 'system')
 * @param {boolean} persistToLocalStorage - Whether to save to localStorage (default: false)
 *                                          Only used for initial FOUC prevention
 */
export const applyTheme = (theme, persistToLocalStorage = false) => {
  if (typeof document === 'undefined') return;
  
  const html = document.documentElement;
  
  // Remove all theme classes first
  html.classList.remove('dark', 'system');
  
  // Apply the appropriate theme class
  if (theme === 'dark') {
    html.classList.add('dark');
  } else if (theme === 'system') {
    html.classList.add('system');
  }
  // 'light' theme = no class (default)
  
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
    theme = getSavedTheme() || 'light';
  } else {
    // If no profile theme and not initial load, use light as default
    theme = 'light';
  }
  
  // Only persist to localStorage on initial load (to prevent FOUC on refresh)
  applyTheme(theme, isInitialLoad);
  return theme;
};

/**
 * System theme is now a distinct blue-tinted theme
 * No longer watches OS preference changes
 * This function is kept for backward compatibility but does nothing
 * @deprecated System theme is now a distinct theme, not OS-based
 */
export const watchSystemTheme = (callback) => {
  // System theme is now a distinct theme, not OS-based
  // Return empty cleanup function
  return () => {};
};
