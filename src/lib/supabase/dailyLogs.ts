// src/lib/supabase/dailyLogs.ts
import { getSupabaseClient } from '@/lib/supabase/supabaseClient';
// Assuming DailyLog type is correctly defined in '@/types'
import { DailyLog } from '@/types';

/**
 * Fetches a single daily log entry for a specific user and date.
 * @param userId - The ID of the user whose log to fetch.
 * @param dateString - The date of the log in 'YYYY-MM-DD' format.
 * @returns The DailyLog object if found, otherwise null.
 * @throws Error if Supabase client fails or a database error occurs.
 */
export async function getDailyLog(userId: string, dateString: string): Promise<DailyLog | null> {
  // Get Supabase client instance
  const supabase = getSupabaseClient();

  // --- Start Fix: Check if Supabase client initialized successfully ---
  if (!supabase) {
    console.error('Service Error (getDailyLog): Supabase client is null. Check environment configuration.');
    // Throw an error to be handled by the calling function (e.g., store action)
    throw new Error('Database connection failed.');
  }
  // --- End Fix ---
  console.log(`Service: Fetching daily log for user ${userId} on date ${dateString}`);

  // Now safe to use supabase
  const { data, error } = await supabase
    .from('daily_logs') // Target the 'daily_logs' table
    .select('*') // Select all columns
    .eq('user_id', userId) // Filter by user ID
    .eq('log_date', dateString) // Filter by log date
    .maybeSingle(); // Expect 0 or 1 row, returns null if 0 rows, throws error only on >1 row

  // Handle potential database errors during fetch
  if (error) {
    console.error(`Service Error: Failed to fetch daily log for ${userId} on ${dateString}:`, error);
    // Throw a more specific error message
    throw new Error(`Failed to fetch daily log: ${error.message}`);
  }

  console.log(`Service: Daily log for ${dateString} ${data ? 'found' : 'not found'}.`);
  // Return the fetched data (which could be null if no log exists for that date)
  // Ensure the returned data structure matches the DailyLog type
  return data as DailyLog | null;
}

/**
 * Updates the deferred habit lists for a specific daily log entry.
 * @param logId - The ID of the daily log entry to update.
 * @param deferredStartupIds - Array of habit IDs deferred from startup, or null.
 * @param deferredShutdownIds - Array of habit IDs deferred from shutdown, or null.
 * @throws Error if Supabase client fails or a database error occurs.
 */
export async function updateDailyLogDeferred(
  logId: string,
  deferredStartupIds: string[] | null,
  deferredShutdownIds: string[] | null
): Promise<void> {
  // Get Supabase client instance
  const supabase = getSupabaseClient();

  // --- Start Fix: Check if Supabase client initialized successfully ---
  if (!supabase) {
    console.error('Service Error (updateDailyLogDeferred): Supabase client is null. Check environment configuration.');
     // Throw an error to be handled by the calling function
    throw new Error('Database connection failed.');
  }
  // --- End Fix ---
  console.log(`Service: Updating deferred habits for log ${logId}`);

  // Prepare the update payload
  const updatePayload = {
      // Use null explicitly if the arrays are null
      deferred_from_startup: deferredStartupIds,
      deferred_from_shutdown: deferredShutdownIds,
      updated_at: new Date().toISOString(), // Update timestamp
  };

  // Now safe to use supabase
  const { error } = await supabase
    .from('daily_logs') // Target the 'daily_logs' table
    .update(updatePayload) // Provide the fields to update
    .eq('id', logId); // Target the specific log entry by its ID

  // Handle potential database errors during update
  if (error) {
    console.error(`Service Error: Failed to update deferred habits for log ${logId}:`, error);
     // Throw a more specific error message
    throw new Error(`Failed to update deferred habits: ${error.message}`);
  }

  console.log(`Service: Successfully updated deferred habits for log ${logId}.`);
  // No return value needed for a successful update (Promise<void>)
}