// src/lib/utils/dateUtils.ts

/**
 * Gets the local date string (YYYY-MM-DD) for a given timezone.
 * Uses Intl API. Falls back to UTC date string on error.
 *
 * @param timezone - The IANA timezone string (e.g., 'America/Los_Angeles').
 * @returns The date string in YYYY-MM-DD format.
 */
export function getLocalDateString(timezone: string): string {
    try {
        const date = new Date();
        // 'en-CA' locale reliably gives YYYY-MM-DD format needed by date inputs/DB
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
        return formatter.format(date);
    } catch (e) {
        console.error(`Failed to format date for timezone ${timezone}:`, e);
        // Fallback to UTC date string if timezone formatting fails
        return new Date().toISOString().split('T')[0];
    }
}

// Add other date-related utility functions here if needed in the future

