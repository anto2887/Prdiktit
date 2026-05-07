import { format, parseISO, formatDistance, formatDistanceToNow, isValid, addDays, isBefore, isAfter } from 'date-fns';

/**
 * TIMEZONE HANDLING DOCUMENTATION:
 * 
 * BACKEND STORAGE: All dates stored as UTC in database
 * API RESPONSES: Dates returned as UTC strings (no Z suffix) - FIXED: Now properly treated as UTC
 * FRONTEND DISPLAY: Convert UTC to user's local timezone
 * 
 * FIXED: Backend sends "2025-08-16T23:30:00" (UTC time) and frontend now correctly converts to local time
 * Example: 23:30 UTC → 5:30 PM MDT (UTC-6)
 */

/**
 * Parse a UTC date string and convert to local time
 * FIXED: Handles naive datetime strings from backend as UTC
 * @param {string|Date} date - UTC date string or Date object
 * @returns {Date|null} Local Date object or null
 */
export const parseUTCToLocal = (date) => {
  if (!date) return null;
  
  try {
    // Handle naive date strings (without timezone info)
    if (typeof date === 'string' && !date.includes('T') && !date.includes('Z')) {
      // Convert naive date string to UTC
      const utcString = `${date}T00:00:00.000Z`;
      process.env.NODE_ENV === 'development' && console.log(`🔧 Converting naive string "${date}" to UTC "${utcString}"`);
      
      const parsedDate = new Date(utcString);
      process.env.NODE_ENV === 'development' && console.log(`✅ Successfully parsed UTC: ${parsedDate.toString()}`);
      return parsedDate;
    }
    
    // Handle ISO strings - distinguish between UTC and timezone-aware
    if (typeof date === 'string' && date.includes('T')) {
      if (date.includes('Z')) {
        // Has timezone info - parse normally
        const parsedDate = new Date(date);
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate;
        }
      } else {
        // No timezone info - treat as UTC and convert to local
        // Backend sends "2025-08-16T23:30:00" which is UTC time
        const utcDate = new Date(date + 'Z');  // Add Z to make it UTC
        if (!isNaN(utcDate.getTime())) {
          process.env.NODE_ENV === 'development' && console.log(`🔧 Treating "${date}" as UTC, converted to: ${utcDate.toString()}`);
          return utcDate;  // JavaScript will convert to local timezone
        }
      }
    }
    
    // Handle Date objects
    if (date instanceof Date) {
      return date;
    }
    
    // Fallback: try to parse as is
    const parsedDate = new Date(date);
    if (!isNaN(parsedDate.getTime())) {
      process.env.NODE_ENV === 'development' && console.log(`⚠️ Used fallback parsing for: ${date}`);
      return parsedDate;
    }
    
    process.env.NODE_ENV === 'development' && console.log(`❌ Failed to parse date: ${date}`);
    return null;
    
  } catch (error) {
    process.env.NODE_ENV === 'development' && console.error('❌ parseUTCToLocal error:', error);
    return null;
  }
};

/**
 * Format a UTC date string to local time with specified format
 * @param {string|Date} date - UTC date to format
 * @param {string} formatStr - Format string (default: 'PPP')
 * @returns {string} Formatted local time
 */
export const formatDate = (date, formatStr = 'PPP') => {
  if (!date) return 'N/A';
  
  const localDate = parseUTCToLocal(date);
  
  if (!localDate) return 'Invalid date';
  
  return format(localDate, formatStr);
};

/**
 * Format match kickoff time clearly for users
 * @param {string|Date} utcDate - UTC kickoff time from backend
 * @returns {string} User-friendly kickoff time in local timezone
 */
export const formatKickoffTime = (utcDate) => {
  if (!utcDate) return 'TBD';
  
  const localDate = parseUTCToLocal(utcDate);
  
  if (!localDate) return 'Invalid time';
  
  // Get timezone abbreviation for clarity
  const timeZone = getTimezoneAbbreviation();
  
  // Compare with today in user's timezone
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const matchDate = new Date(localDate.getFullYear(), localDate.getMonth(), localDate.getDate());
  
  const dayDiff = Math.round((matchDate - today) / (1000 * 60 * 60 * 24));
  
  if (dayDiff === 0) {
    return `Today at ${format(localDate, 'h:mm a')} ${timeZone}`;
  } else if (dayDiff === 1) {
    return `Tomorrow at ${format(localDate, 'h:mm a')} ${timeZone}`;
  } else if (dayDiff === -1) {
    return `Yesterday at ${format(localDate, 'h:mm a')} ${timeZone}`;
  } else if (dayDiff >= 2 && dayDiff <= 6) {
    return format(localDate, `EEEE 'at' h:mm a`) + ` ${timeZone}`;
  } else {
    return format(localDate, `EEE, MMM d 'at' h:mm a`) + ` ${timeZone}`;
  }
};

/**
 * Format deadline time with urgency indicator
 * @param {string|Date} utcDate - UTC deadline time
 * @returns {object} Object with formatted time and urgency level
 */
export const formatDeadlineTime = (utcDate) => {
  if (!utcDate) return { text: 'No deadline set', urgency: 'none' };
  
  const localDate = parseUTCToLocal(utcDate);
  
  if (!localDate) return { text: 'Invalid deadline', urgency: 'none' };
  
  const now = new Date();
  const timeDiff = localDate - now;
  const hoursDiff = timeDiff / (1000 * 60 * 60);
  const minutesDiff = timeDiff / (1000 * 60);
  
  let urgency = 'low';
  let text = formatKickoffTime(utcDate);
  
  if (timeDiff <= 0) {
    urgency = 'expired';
    const minutesPassed = Math.abs(Math.round(minutesDiff));
    text = minutesPassed < 60 
      ? `Deadline passed ${minutesPassed}m ago`
      : `Deadline passed ${Math.round(Math.abs(hoursDiff))}h ago`;
  } else if (hoursDiff <= 1) {
    urgency = 'critical';
    text = `${text} (${Math.round(minutesDiff)} min remaining)`;
  } else if (hoursDiff <= 6) {
    urgency = 'high';
    text = `${text} (${Math.round(hoursDiff)} hrs remaining)`;
  } else if (hoursDiff <= 24) {
    urgency = 'medium';
  }
  
  return { text, urgency };
};

/**
 * Check if a UTC date is in the past (local time)
 * @param {string|Date} utcDate - UTC date to check
 * @returns {boolean} True if date is in the past
 */
export const isDateInPast = (utcDate) => {
  if (!utcDate) return false;
  
  const localDate = parseUTCToLocal(utcDate);
  
  if (!localDate) return false;
  
  return localDate < new Date();
};

/**
 * Get user's timezone name
 * @returns {string} User's timezone (e.g., "America/New_York")
 */
export const getUserTimezone = () => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

/**
 * Get user's timezone abbreviation
 * @returns {string} Timezone abbreviation (e.g., "EST", "PST")
 */
export const getTimezoneAbbreviation = () => {
  const now = new Date();
  const timeZoneName = now.toLocaleDateString('en', {
    day: '2-digit',
    timeZoneName: 'short',
  }).slice(4);
  
  return timeZoneName;
};

/**
 * Convert local datetime to UTC for sending to backend
 * @param {Date} localDate - Local date object
 * @returns {string} UTC ISO string for backend
 */
export const convertLocalToUTC = (localDate) => {
  if (!localDate || !(localDate instanceof Date)) return null;
  return localDate.toISOString(); // Always returns UTC
};

/**
 * Get detailed timezone information for user
 * @returns {object} Timezone details
 */
export const getTimezoneInfo = () => {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = new Date();
  
  // Get timezone offset
  const offsetMinutes = now.getTimezoneOffset();
  const offsetHours = Math.abs(offsetMinutes / 60);
  const offsetSign = offsetMinutes <= 0 ? '+' : '-';
  const offsetString = `UTC${offsetSign}${offsetHours.toString().padStart(2, '0')}`;
  
  // Get abbreviation
  const abbreviation = getTimezoneAbbreviation();
  
  return {
    name: timezone,
    abbreviation: abbreviation,
    offset: offsetString,
    offsetMinutes: offsetMinutes
  };
};

// Additional utility functions
export const formatShortDate = (date) => {
  return formatDate(date, 'MMM d, yyyy');
};

export const formatDateTime = (date) => {
  return formatDate(date, 'MMM d, yyyy \'at\' h:mm a');
};

export const formatFullDateTime = (date) => {
  return formatDate(date, 'EEEE, MMM d, yyyy \'at\' h:mm a');
};

export const formatTime = (date) => {
  return formatDate(date, 'h:mm a');
};

export const formatTime24 = (date) => {
  return formatDate(date, 'HH:mm');
};

export const formatRelativeTime = (date) => {
  if (!date) return 'N/A';
  
  const localDate = parseUTCToLocal(date);
  
  if (!localDate) return 'Invalid date';
  
  return formatDistanceToNow(localDate, { addSuffix: true });
};

// Legacy exports for backward compatibility
export const formatDateDistance = (dateFrom, dateTo) => {
  if (!dateFrom || !dateTo) return 'N/A';
  
  const localDateFrom = parseUTCToLocal(dateFrom);
  const localDateTo = parseUTCToLocal(dateTo);
  
  if (!localDateFrom || !localDateTo) return 'Invalid date';
  
  return formatDistance(localDateFrom, localDateTo);
};

export const addDaysToDate = (date, days) => {
  if (!date) return null;
  
  const localDate = parseUTCToLocal(date);
  
  if (!localDate) return null;
  
  return addDays(localDate, days);
};

export const isDateBefore = (date, dateToCompare) => {
  if (!date || !dateToCompare) return false;
  
  const localDate = parseUTCToLocal(date);
  const localDateToCompare = parseUTCToLocal(dateToCompare);
  
  if (!localDate || !localDateToCompare) return false;
  
  return isBefore(localDate, localDateToCompare);
};

export const isDateAfter = (date, dateToCompare) => {
  if (!date || !dateToCompare) return false;
  
  const localDate = parseUTCToLocal(date);
  const localDateToCompare = parseUTCToLocal(dateToCompare);
  
  if (!localDate || !localDateToCompare) return false;
  
  return isAfter(localDate, localDateToCompare);
};

export const formatISODate = (date) => {
  if (!date) return null;
  
  const localDate = parseUTCToLocal(date);
  
  if (!localDate) return null;
  
  return localDate.toISOString();
};