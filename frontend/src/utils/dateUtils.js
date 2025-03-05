// src/utils/dateUtils.js
import { format, parseISO, formatDistance, formatDistanceToNow, isValid, addDays, isBefore, isAfter } from 'date-fns';

/**
 * Format a date string to a readable format
 * @param {string|Date} date - Date to format
 * @param {string} formatStr - Format string (default: 'PPP')
 * @returns {string} Formatted date
 */
export const formatDate = (date, formatStr = 'PPP') => {
  if (!date) return 'N/A';
  
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  
  if (!isValid(parsedDate)) return 'Invalid date';
  
  return format(parsedDate, formatStr);
};

/**
 * Format a date to a short format (e.g. "Aug 12, 2023")
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date
 */
export const formatShortDate = (date) => {
  return formatDate(date, 'MMM d, yyyy');
};

/**
 * Format a date and time (e.g. "Aug 12, 2023, 14:30")
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date and time
 */
export const formatDateTime = (date) => {
  return formatDate(date, 'MMM d, yyyy, HH:mm');
};

/**
 * Format time only (e.g. "14:30")
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted time
 */
export const formatTime = (date) => {
  return formatDate(date, 'HH:mm');
};

/**
 * Format a date relative to current time (e.g. "5 minutes ago")
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted relative time
 */
export const formatRelativeTime = (date) => {
  if (!date) return 'N/A';
  
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  
  if (!isValid(parsedDate)) return 'Invalid date';
  
  return formatDistanceToNow(parsedDate, { addSuffix: true });
};

/**
 * Format the distance between two dates
 * @param {string|Date} dateFrom - Start date
 * @param {string|Date} dateTo - End date
 * @returns {string} Formatted distance
 */
export const formatDateDistance = (dateFrom, dateTo) => {
  if (!dateFrom || !dateTo) return 'N/A';
  
  const parsedDateFrom = typeof dateFrom === 'string' ? parseISO(dateFrom) : dateFrom;
  const parsedDateTo = typeof dateTo === 'string' ? parseISO(dateTo) : dateTo;
  
  if (!isValid(parsedDateFrom) || !isValid(parsedDateTo)) return 'Invalid date';
  
  return formatDistance(parsedDateFrom, parsedDateTo);
};

/**
 * Add days to a date
 * @param {string|Date} date - Date to modify
 * @param {number} days - Number of days to add
 * @returns {Date} New date
 */
export const addDaysToDate = (date, days) => {
  if (!date) return null;
  
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  
  if (!isValid(parsedDate)) return null;
  
  return addDays(parsedDate, days);
};

/**
 * Check if a date is before another date
 * @param {string|Date} date - Date to check
 * @param {string|Date} dateToCompare - Date to compare against
 * @returns {boolean} True if date is before dateToCompare
 */
export const isDateBefore = (date, dateToCompare) => {
  if (!date || !dateToCompare) return false;
  
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  const parsedDateToCompare = typeof dateToCompare === 'string' ? parseISO(dateToCompare) : dateToCompare;
  
  if (!isValid(parsedDate) || !isValid(parsedDateToCompare)) return false;
  
  return isBefore(parsedDate, parsedDateToCompare);
};

/**
 * Check if a date is after another date
 * @param {string|Date} date - Date to check
 * @param {string|Date} dateToCompare - Date to compare against
 * @returns {boolean} True if date is after dateToCompare
 */
export const isDateAfter = (date, dateToCompare) => {
  if (!date || !dateToCompare) return false;
  
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  const parsedDateToCompare = typeof dateToCompare === 'string' ? parseISO(dateToCompare) : dateToCompare;
  
  if (!isValid(parsedDate) || !isValid(parsedDateToCompare)) return false;
  
  return isAfter(parsedDate, parsedDateToCompare);
};

/**
 * Format a date as ISO string (e.g. "2023-08-15T14:30:00Z")
 * @param {string|Date} date - Date to format
 * @returns {string} ISO formatted date string
 */
export const formatISODate = (date) => {
  if (!date) return null;
  
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  
  if (!isValid(parsedDate)) return null;
  
  return parsedDate.toISOString();
};