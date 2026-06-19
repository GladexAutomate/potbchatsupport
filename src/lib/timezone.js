import { formatDistanceToNow, format } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

// Centralized timezone for the app: Philippines (Asia/Manila)
const TIMEZONE = 'Asia/Manila';

/**
 * Format a date for display in Philippines timezone
 * Returns formatted date string (e.g., "Jun. 19, 2026")
 */
export const formatDateRelative = (date) => {
  if (!date) return '';
  const zonedDate = toZonedTime(new Date(date), TIMEZONE);
  return format(zonedDate, 'MMM. d, yyyy');
};

/**
 * Format a date for display in Philippines timezone with time
 * Returns formatted date string (e.g., "Jun. 19, 2026 2:30 PM")
 */
export const formatDateFull = (date) => {
  if (!date) return '';
  const zonedDate = toZonedTime(new Date(date), TIMEZONE);
  return format(zonedDate, 'MMM. d, yyyy h:mm a');
};

/**
 * Get current time in Philippines timezone
 */
export const getNowInTimezone = () => {
  return toZonedTime(new Date(), TIMEZONE);
};

/**
 * Convert a local date to UTC for storage
 */
export const localToUTC = (localDate) => {
  return fromZonedTime(new Date(localDate), TIMEZONE);
};