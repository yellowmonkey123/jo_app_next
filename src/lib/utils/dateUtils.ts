// src/lib/utils/dateUtils.ts
import { formatInTimeZone } from 'date-fns-tz';
import { add, Duration } from 'date-fns'; // Import 'add' and 'Duration'

/**
 * Gets the date string (YYYY-MM-DD) in the specified IANA timezone.
 * Can optionally apply a date offset (e.g., { days: -1 } for yesterday).
 * Uses date-fns-tz for robust timezone handling.
 *
 * @param timezone - The IANA timezone string (e.g., 'America/Los_Angeles').
 * @param offset - Optional duration to add/subtract from the current date (e.g., { days: number }).
 * @returns The formatted date string (YYYY-MM-DD) or null if timezone is invalid.
 */
export function getLocalDateString(
  timezone: string,
  offset?: Duration // Use the Duration type from date-fns
): string | null {
  try {
    // Get the current date
    const now = new Date();

    // Apply the offset if provided
    const targetDate = offset ? add(now, offset) : now;

    // Format the target date in the specified timezone
    // See: https://github.com/marnusw/date-fns-tz#formatintimezone
    // See format options: https://date-fns.org/v3.6.0/docs/format
    // Using 'yyyy-MM-dd' format which is compatible with databases and date inputs
    const dateString = formatInTimeZone(targetDate, timezone, 'yyyy-MM-dd');
    return dateString;
  } catch (error) {
    // Log error if timezone is invalid or another issue occurs
    console.error(`Error getting local date string for timezone ${timezone}:`, error);
    // Return null or handle the error as appropriate for your application
    return null;
  }
}

/**
 * Removes properties with undefined values from an object.
 * Useful for cleaning objects before database updates where undefined
 * might cause issues or is unnecessary.
 *
 * @param obj - The object to strip undefined values from.
 * @returns A new object with only defined values.
 */
export function stripUndefined<T extends object>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  // Iterate over object entries
  for (const [key, value] of Object.entries(obj) as [keyof T, T[keyof T]][]) {
    // Keep the property only if its value is not undefined
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}
