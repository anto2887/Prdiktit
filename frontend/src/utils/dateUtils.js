/**
 * TIMEZONE HANDLING DOCUMENTATION:
 * 
 * BACKEND STORAGE: All dates stored as UTC in database
 * API RESPONSES: All dates returned as UTC ISO strings
 * FRONTEND DISPLAY: Convert UTC to user's local timezone
 * 
 * CRITICAL: Never send local times to backend - always use UTC
 */

import { format, parseISO, formatDistance, formatDistanceToNow, isValid } from 'date-fns';

/**
 * Parse a UTC date string/object and return as local Date
 * @param {string|Date} utcDate - UTC date from backend
 * @returns {Date|null} Local Date object or null
 */
export const parseUTCToLocal = (utcDate) => {
  if (!utcDate) return null;
  
  // If already a Date object, return as-is (assumed to be correctly parsed)
  if (utcDate instanceof Date) return utcDate;
  
  // Parse ISO string with timezone info
  const parsedDate = parseISO(utcDate);
  
  if (!isValid(parsedDate)) {
    console.warn(`Invalid date provided to parseUTCToLocal: ${utcDate}`);
    return null;
  }
  
  return parsedDate;
};

/**
 * Get timezone abbreviation for the user's local timezone
 * @returns {string} Timezone abbreviation
 */
export const getTimezoneAbbreviation = () => {
  try {
    const date = new Date();
    // Use Intl.DateTimeFormat to get abbreviation
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZoneName: 'short'
    }).formatToParts(date);
    const tz = parts.find(part => part.type === 'timeZoneName');
    return tz ? tz.value.replace('GMT', 'UTC') : 'UTC';
  } catch {
    return 'UTC';
  }
};

/**
 * Format UTC kickoff time with clear timezone indication
 * @param {string|Date} utcDate - UTC kickoff time from backend
 * @returns {string} User-friendly kickoff time in local timezone
 */
export const formatKickoffTime = (utcDate) => {
  if (!utcDate) return 'TBD';
  
  const localDate = parseUTCToLocal(utcDate);
  if (!localDate) return 'Invalid time';
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const matchDate = new Date(localDate.getFullYear(), localDate.getMonth(), localDate.getDate());
  
  const dayDiff = Math.round((matchDate - today) / (1000 * 60 * 60 * 24));
  
  // Get timezone abbreviation for clarity
  const timeZone = getTimezoneAbbreviation();
  
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
 * Enhanced deadline formatting with urgency and timezone clarity
 * @param {string|Date} utcDate - UTC deadline from backend
 * @returns {object} Object with formatted text and urgency level
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
      : `Deadline passed ${Math.round(hoursDiff)}h ago`;
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