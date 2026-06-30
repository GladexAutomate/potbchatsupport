import { formatDistanceToNow as fnsFormatDistanceToNow, format } from 'date-fns';
import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';

/**
 * THE single timezone for the ENTIRE app: Philippines (Asia/Manila).
 *
 * Every date shown anywhere in the app MUST be formatted through one of the
 * helpers below. Do NOT write component-local date formatters (no manual
 * `+ 8 * 60 * 60 * 1000`, no `toLocaleString`, no inline `toZonedTime`) — those
 * drift out of sync and produce wrong times. Add a new helper here if you need a
 * new format, then use it everywhere.
 *
 * All helpers take a UTC instant (ISO string, ms, or Date) and render it in
 * Asia/Manila via `formatInTimeZone`, which is unambiguous (no double-offset).
 */
export const APP_TIMEZONE = 'Asia/Manila';

const toDate = (date) => (date instanceof Date ? date : new Date(date));

// "Jun. 30, 2026 2:22 PM" — full date + time. Default for chat/message timestamps.
export const formatDateFull = (date) => {
  if (!date) return '';
  return formatInTimeZone(toDate(date), APP_TIMEZONE, 'MMM. d, yyyy h:mm a');
};

// Alias kept for existing callers (same output as full).
export const formatDateRelative = formatDateFull;

// "Jun 30, 2:22 PM" — compact date + time (no year). For tight chat bubbles.
export const formatDateShort = (date) => {
  if (!date) return '';
  return formatInTimeZone(toDate(date), APP_TIMEZONE, 'MMM d, h:mm a');
};

// "Tue, Jun 30" — day label (chat day separators).
export const formatDateDay = (date) => {
  if (!date) return '';
  return formatInTimeZone(toDate(date), APP_TIMEZONE, 'EEE, MMM d');
};

// "Jun 30" — month + day only.
export const formatMonthDay = (date) => {
  if (!date) return '';
  return formatInTimeZone(toDate(date), APP_TIMEZONE, 'MMM d');
};

// Escape hatch: format with ANY date-fns pattern, always in Asia/Manila. Use this
// instead of importing date-fns `format` so no component invents its own timezone.
export const formatInAppTz = (date, pattern) => {
  if (!date) return '';
  return formatInTimeZone(toDate(date), APP_TIMEZONE, pattern);
};

// Relative ("about 8 hours ago"). Timezone-agnostic by nature, but centralized
// here so callers never import date-fns directly for app dates.
export const formatRelative = (date) => {
  if (!date) return '';
  return fnsFormatDistanceToNow(toDate(date), { addSuffix: true });
};

/**
 * Current time as a Date whose local fields equal Manila wall-clock (for
 * day/“today” comparisons). Prefer the format helpers above for display.
 */
export const getNowInTimezone = () => toZonedTime(new Date(), APP_TIMEZONE);

/**
 * Convert a Manila wall-clock date to the equivalent UTC instant for storage.
 */
export const localToUTC = (localDate) => fromZonedTime(new Date(localDate), APP_TIMEZONE);

/**
 * Convert old "[DD/MM/YYYY, HH:MM:SS]" note timestamps to "[MMM. DD, YYYY, h:mm a]".
 * These components are ALREADY Philippine wall-clock time, so they are reformatted
 * as-is (no timezone conversion, which would double-shift them).
 */
export const convertOldTimestampFormat = (text) => {
  if (!text) return text;
  return text.replace(/\[(\d{2})\/(\d{2})\/(\d{4}),\s(\d{2}):(\d{2}):(\d{2})\]/g, (match, day, month, year, hours, mins, secs) => {
    const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(mins), Number(secs));
    if (Number.isNaN(date.getTime())) return match;
    return `[${format(date, 'MMM. d, yyyy, h:mm a')}]`;
  });
};
