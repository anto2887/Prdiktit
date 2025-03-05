// src/utils/validation.js

/**
 * Validate an email address
 * @param {string} email - Email to validate
 * @returns {boolean} Is valid email
 */
export const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  
  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @returns {Object} Validation result and message
   */
  export const validatePassword = (password) => {
    if (!password) {
      return { isValid: false, message: 'Password is required' };
    }
    
    if (password.length < 8) {
      return { isValid: false, message: 'Password must be at least 8 characters long' };
    }
    
    // Check for at least one uppercase letter, one lowercase letter, and one number
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    
    if (!hasUppercase || !hasLowercase || !hasNumber) {
      return { 
        isValid: false, 
        message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' 
      };
    }
    
    return { isValid: true, message: 'Password is strong' };
  };
  
  /**
   * Validate username
   * @param {string} username - Username to validate
   * @returns {Object} Validation result and message
   */
  export const validateUsername = (username) => {
    if (!username) {
      return { isValid: false, message: 'Username is required' };
    }
    
    if (username.length < 3) {
      return { isValid: false, message: 'Username must be at least 3 characters long' };
    }
    
    // Only allow alphanumeric characters and underscores
    const isAlphanumeric = /^[a-zA-Z0-9_]+$/.test(username);
    
    if (!isAlphanumeric) {
      return { 
        isValid: false, 
        message: 'Username can only contain letters, numbers, and underscores' 
      };
    }
    
    return { isValid: true, message: 'Username is valid' };
  };
  
  /**
   * Validate match score
   * @param {string|number} score - Score to validate
   * @returns {Object} Validation result and message
   */
  export const validateScore = (score) => {
    // Convert to number if string
    const numScore = typeof score === 'string' ? parseInt(score, 10) : score;
    
    if (isNaN(numScore)) {
      return { isValid: false, message: 'Score must be a number' };
    }
    
    if (numScore < 0) {
      return { isValid: false, message: 'Score cannot be negative' };
    }
    
    if (numScore > 20) {
      return { isValid: false, message: 'Score is unrealistically high' };
    }
    
    return { isValid: true, message: 'Score is valid' };
  };
  
  /**
   * Validate group name
   * @param {string} name - Group name to validate
   * @returns {Object} Validation result and message
   */
  export const validateGroupName = (name) => {
    if (!name) {
      return { isValid: false, message: 'Group name is required' };
    }
    
    if (name.length < 3) {
      return { isValid: false, message: 'Group name must be at least 3 characters long' };
    }
    
    if (name.length > 50) {
      return { isValid: false, message: 'Group name cannot exceed 50 characters' };
    }
    
    return { isValid: true, message: 'Group name is valid' };
  };
  
  /**
   * Validate invite code
   * @param {string} code - Invite code to validate
   * @returns {Object} Validation result and message
   */
  export const validateInviteCode = (code) => {
    if (!code) {
      return { isValid: false, message: 'Invite code is required' };
    }
    
    if (code.length !== 8) {
      return { isValid: false, message: 'Invite code must be 8 characters long' };
    }
    
    // Invite codes are usually uppercase alphanumeric
    const isValidFormat = /^[A-Z0-9]+$/.test(code);
    
    if (!isValidFormat) {
      return { 
        isValid: false, 
        message: 'Invite code can only contain uppercase letters and numbers' 
      };
    }
    
    return { isValid: true, message: 'Invite code is valid' };
  };
  
  /**
   * Validate form fields
   * @param {Object} fields - Form fields
   * @param {Object} validations - Validation rules
   * @returns {Object} Validation errors
   */
  export const validateForm = (fields, validations) => {
    const errors = {};
    
    Object.keys(validations).forEach(field => {
      const value = fields[field];
      const validation = validations[field];
      
      if (validation.required && !value) {
        errors[field] = `${validation.label || field} is required`;
      } else if (value && validation.validator) {
        const result = validation.validator(value);
        if (!result.isValid) {
          errors[field] = result.message;
        }
      }
    });
    
    return errors;
  };