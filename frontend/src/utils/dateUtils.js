
// src/utils/dateUtils.js
import { format, parseISO, formatDistance, formatDistanceToNow, isValid, addDays, isBefore, isAfter } from 'date-fns';

/**
 * Parse a UTC date string and convert to local time
 * @param {string|Date} date - UTC date string or Date object
 * @returns {Date|null} Local Date object or null
 */
export const parseUTCToLocal = (date) => {
  if (!date) return null;
  
  // If it's already a Date object, return it
  if (date instanceof Date) return date;
  
  // Parse ISO string - parseISO automatically handles timezone info
  const parsedDate = parseISO(date);
  
  if (!isValid(parsedDate)) return null;
  
  return parsedDate;
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
 * Format a UTC date to local short date (e.g. "Aug 12, 2023")
 * @param {string|Date} date - UTC date to format
 * @returns {string} Formatted local date
 */
export const formatShortDate = (date) => {
  return formatDate(date, 'MMM d, yyyy');
};

/**
 * Format a UTC date to local date and time (e.g. "Aug 12, 2023 at 2:30 PM")
 * @param {string|Date} date - UTC date to format
 * @returns {string} Formatted local date and time
 */
export const formatDateTime = (date) => {
  return formatDate(date, 'MMM d, yyyy \'at\' h:mm a');
};

/**
 * Format a UTC date to local date and time with day (e.g. "Saturday, Aug 12, 2023 at 2:30 PM")
 * @param {string|Date} date - UTC date to format
 * @returns {string} Formatted local date and time with day
 */
export const formatFullDateTime = (date) => {
  return formatDate(date, 'EEEE, MMM d, yyyy \'at\' h:mm a');
};

/**
 * Format time only in local timezone (e.g. "2:30 PM")
 * @param {string|Date} date - UTC date to format
 * @returns {string} Formatted local time
 */
export const formatTime = (date) => {
  return formatDate(date, 'h:mm a');
};

/**
 * Format time only in 24-hour format (e.g. "14:30")
 * @param {string|Date} date - UTC date to format
 * @returns {string} Formatted local time in 24-hour format
 */
export const formatTime24 = (date) => {
  return formatDate(date, 'HH:mm');
};

/**
 * Format a UTC date relative to current local time (e.g. "5 minutes ago")
 * @param {string|Date} date - UTC date to format
 * @returns {string} Formatted relative time
 */
export const formatRelativeTime = (date) => {
  if (!date) return 'N/A';
  
  const localDate = parseUTCToLocal(date);
  
  if (!localDate) return 'Invalid date';
  
  return formatDistanceToNow(localDate, { addSuffix: true });
};

/**
 * Format match kickoff time clearly for users
 * @param {string|Date} utcDate - UTC kickoff time
 * @returns {string} User-friendly kickoff time
 */
export const formatKickoffTime = (utcDate) => {
  if (!utcDate) return 'TBD';
  
  const localDate = parseUTCToLocal(utcDate);
  
  if (!localDate) return 'Invalid time';
  
  // Example: "Today at 2:30 PM" or "Tomorrow at 2:30 PM" or "Sat, Aug 12 at 2:30 PM"
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const matchDate = new Date(localDate.getFullYear(), localDate.getMonth(), localDate.getDate());
  
  const dayDiff = Math.round((matchDate - today) / (1000 * 60 * 60 * 24));
  
  if (dayDiff === 0) {
    return `Today at ${format(localDate, 'h:mm a')}`;
  } else if (dayDiff === 1) {
    return `Tomorrow at ${format(localDate, 'h:mm a')}`;
  } else if (dayDiff === -1) {
    return `Yesterday at ${format(localDate, 'h:mm a')}`;
  } else if (dayDiff >= 2 && dayDiff <= 6) {
    return format(localDate, 'EEEE \'at\' h:mm a');
  } else {
    return format(localDate, 'EEE, MMM d \'at\' h:mm a');
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
  
  let urgency = 'low';
  let text = formatKickoffTime(utcDate);
  
  if (timeDiff <= 0) {
    urgency = 'expired';
    text = 'Deadline passed';
  } else if (hoursDiff <= 1) {
    urgency = 'critical';
    text = `${text} (${Math.round(timeDiff / (1000 * 60))} min remaining)`;
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