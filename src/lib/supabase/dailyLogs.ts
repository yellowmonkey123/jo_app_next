// src/lib/supabase/dailyLogs.ts
import { supabase } from '@/lib/supabase/client';
import { DailyLog } from '@/types'; // Import your updated DailyLog type

/**
 * Fetches a single daily log entry for a specific user and date.
 * Returns null if no log exists for that user/date combination.
 *
 * @param userId - The UUID of the user.
 * @param dateString - The log date in 'YYYY-MM-DD' format.
 * @returns Promise<DailyLog | null> - The daily log object or null.
 * @throws Will throw an error if the Supabase query fails.
 */
export async function getDailyLog(userId: string, dateString: string): Promise<DailyLog | null> {
    console.log(`Service: Fetching daily log for user ${userId} on date ${dateString}`);

    const { data, error } = await supabase
        .from('daily_logs')
        .select('*') // Select all columns, including new deferred ones
        .eq('user_id', userId)
        .eq('log_date', dateString)
        .maybeSingle(); // Use maybeSingle() to return null instead of error if not found

    if (error) {
        console.error(`Service Error: Failed to fetch daily log for ${userId} on ${dateString}:`, error);
        throw new Error(`Failed to fetch daily log: ${error.message}`);
    }

    console.log(`Service: Daily log for ${dateString} ${data ? 'found' : 'not found'}.`);
    return data; // Returns the log object or null
}

/**
 * Updates the deferred habit arrays for a specific daily log entry.
 * Assumes the log entry already exists.
 *
 * @param logId - The UUID of the specific daily_log row to update.
 * @param deferredStartupIds - The updated array of habit IDs deferred from startup.
 * @param deferredShutdownIds - The updated array of habit IDs deferred from shutdown.
 * @returns Promise<void>
 * @throws Will throw an error if the Supabase update operation fails.
 */
export async function updateDailyLogDeferred(
    logId: string,
    deferredStartupIds: string[] | null,
    deferredShutdownIds: string[] | null
): Promise<void> {
    console.log(`Service: Updating deferred habits for log ${logId}`);

    const { error } = await supabase
        .from('daily_logs')
        .update({
            deferred_from_startup: deferredStartupIds,
            deferred_from_shutdown: deferredShutdownIds,
            updated_at: new Date().toISOString() // Also update the timestamp
        })
        .eq('id', logId); // Target the specific log entry by its ID

    if (error) {
        console.error(`Service Error: Failed to update deferred habits for log ${logId}:`, error);
        throw new Error(`Failed to update deferred habits: ${error.message}`);
    }

    console.log(`Service: Successfully updated deferred habits for log ${logId}.`);
}


// --- Potential Future Service Functions for dailyLogs ---
// export async function upsertStartupLog(logData: Partial<DailyLog>) { /* ... */ }
// export async function upsertShutdownLog(logData: Partial<DailyLog>) { /* ... */ }
// export async function getTodayLogRpc(userId: string) { /* Wrap RPC call */ }
// export async function getWeeklyReportRpc(userId: string) { /* Wrap RPC call */ }

