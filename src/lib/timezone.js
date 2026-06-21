import { formatDistanceToNow, format } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

// Centralized timezone for the app: Philippines (Asia/Manila)
export const APP_TIMEZONE = 'Asia/Manila';

/**
 * Format a date for display in Philippines timezone
 * Returns formatted date string (e.g., "Jun. 19, 2026")
 */
export const formatDateRelative = (date) => {
  if (!date) return '';
  const zonedDate = toZonedTime(new Date(date), APP_TIMEZONE);
  return format(zonedDate, 'MMM. d, yyyy h:mm a');
};

/**
 * Format a date for display in Philippines timezone with time
 * Returns formatted date string (e.g., "Jun. 19, 2026 2:30 PM")
 */
export const formatDateFull = (date) => {
  if (!date) return '';
  const zonedDate = toZonedTime(new Date(date), APP_TIMEZONE);
  return format(zonedDate, 'MMM. d, yyyy h:mm a');
};

/**
 * Get current time in Philippines timezone
 */
export const getNowInTimezone = () => {
  return toZonedTime(new Date(), APP_TIMEZONE);
};

/**
 * Convert a local date to UTC for storage
 */
export const localToUTC = (localDate) => {
  return fromZonedTime(new Date(localDate), APP_TIMEZONE);
};

/**
 * Convert old 24-hour timestamp format to 12-hour AM/PM format in note text
 * Converts "[DD/MM/YYYY, HH:MM:SS]" to "[MMM. DD, YYYY, h:mm a]"
 */
export const convertOldTimestampFormat = (text) => {
  if (!text) return text;
  return text.replace(/\[(\d{2})\/(\d{2})\/(\d{4}),\s(\d{2}):(\d{2}):(\d{2})\]/g, (match, day, month, year, hours, mins, secs) => {
    const date = new Date(year, month - 1, day, hours, mins, secs);
    const zonedDate = toZonedTime(date, APP_TIMEZONE);
    const formatted = format(zonedDate, 'MMM. d, yyyy, h:mm a');
    return `[${formatted}]`;
  });
};