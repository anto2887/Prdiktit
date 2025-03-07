// src/utils/storageUtils.js

/**
 * Set an item in localStorage with optional expiration
 * @param {string} key - Storage key
 * @param {any} value - Value to store
 * @param {number} [expirationHours=null] - Optional expiration in hours
 */
export const setLocalStorageItem = (key, value, expirationHours = null) => {
    try {
      const item = {
        value: value
      };
      
      if (expirationHours) {
        const now = new Date();
        item.expiry = now.getTime() + (expirationHours * 60 * 60 * 1000);
      }
      
      localStorage.setItem(key, JSON.stringify(item));
    } catch (error) {
      console.error('Error setting localStorage item:', error);
    }
  };
  
  /**
   * Get an item from localStorage with expiration check
   * @param {string} key - Storage key
   * @returns {any} Stored value or null if expired or not found
   */
  export const getLocalStorageItem = (key) => {
    try {
      const itemStr = localStorage.getItem(key);
      
      if (!itemStr) {
        return null;
      }
      
      const item = JSON.parse(itemStr);
      
      // Check for expiration
      if (item.expiry && new Date().getTime() > item.expiry) {
        localStorage.removeItem(key);
        return null;
      }
      
      return item.value;
    } catch (error) {
      console.error('Error getting localStorage item:', error);
      return null;
    }
  };
  
  /**
   * Remove an item from localStorage
   * @param {string} key - Storage key
   */
  export const removeLocalStorageItem = (key) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing localStorage item:', error);
    }
  };
  
  /**
   * Clear all items from localStorage
   */
  export const clearLocalStorage = () => {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  };
  
  /**
   * Set an item in sessionStorage
   * @param {string} key - Storage key
   * @param {any} value - Value to store
   */
  export const setSessionStorageItem = (key, value) => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Error setting sessionStorage item:', error);
    }
  };
  
  /**
   * Get an item from sessionStorage
   * @param {string} key - Storage key
   * @returns {any} Stored value or null if not found
   */
  export const getSessionStorageItem = (key) => {
    try {
      const itemStr = sessionStorage.getItem(key);
      
      if (!itemStr) {
        return null;
      }
      
      return JSON.parse(itemStr);
    } catch (error) {
      console.error('Error getting sessionStorage item:', error);
      return null;
    }
  };
  
  /**
   * Remove an item from sessionStorage
   * @param {string} key - Storage key
   */
  export const removeSessionStorageItem = (key) => {
    try {
      sessionStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing sessionStorage item:', error);
    }
  };
  
  /**
   * Clear all items from sessionStorage
   */
  export const clearSessionStorage = () => {
    try {
      sessionStorage.clear();
    } catch (error) {
      console.error('Error clearing sessionStorage:', error);
    }
  };