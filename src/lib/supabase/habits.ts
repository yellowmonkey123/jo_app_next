// src/lib/supabase/habits.ts
import { getSupabaseClient } from '@/lib/supabase/supabaseClient';
// Assuming Habit type is correctly defined in '@/types'
import { Habit } from '@/types';

/**
 * Fetches all habits for a specific user, ordered by timing and sort_order.
 * @param userId - The ID of the user whose habits to fetch.
 * @returns An array of Habit objects.
 * @throws Error if Supabase client fails or a database error occurs.
 */
export async function getHabitsForUser(userId: string): Promise<Habit[]> {
  // Get Supabase client instance
  const supabase = getSupabaseClient();

  // --- Start Fix: Check if Supabase client initialized successfully ---
  if (!supabase) {
    console.error('Service Error (getHabitsForUser): Supabase client is null. Check environment configuration.');
    // Throw an error to be handled by the calling function
    throw new Error('Database connection failed.');
  }
  // --- End Fix ---
  console.log(`Service: Fetching habits for user ${userId}`);

  // Now safe to use supabase
  const { data, error } = await supabase
    .from('habits') // Target 'habits' table
    .select('*') // Select all columns
    .eq('user_id', userId) // Filter by user ID
    .order('timing', { ascending: true }) // Primary sort by timing (AM, ANYTIME, PM)
    .order('sort_order', { ascending: true, nullsFirst: false }); // Secondary sort by user-defined order

  // Handle potential database errors during fetch
  if (error) {
    console.error('Service Error: Failed to fetch habits:', error);
    // Throw a more specific error message
    throw new Error(`Failed to fetch habits: ${error.message}`);
  }

  console.log(`Service: Fetched ${data?.length ?? 0} habits.`);
  // Return the fetched data (empty array if no habits found)
  // Ensure the returned data structure matches the Habit type array
  return (data as Habit[]) || [];
}

/**
 * Deletes a specific habit by its ID.
 * @param habitId - The ID of the habit to delete.
 * @throws Error if Supabase client fails or a database error occurs.
 */
export async function deleteHabitById(habitId: string): Promise<void> {
  // Get Supabase client instance
  const supabase = getSupabaseClient();

  // --- Start Fix: Check if Supabase client initialized successfully ---
  if (!supabase) {
    console.error('Service Error (deleteHabitById): Supabase client is null. Check environment configuration.');
     // Throw an error to be handled by the calling function
    throw new Error('Database connection failed.');
  }
  // --- End Fix ---
  console.log(`Service: Deleting habit ${habitId}`);

  // Now safe to use supabase
  const { error } = await supabase
    .from('habits') // Target 'habits' table
    .delete() // Perform delete operation
    .eq('id', habitId); // Match the specific habit ID

  // Handle potential database errors during delete
  if (error) {
    console.error(`Service Error: Failed to delete habit ${habitId}:`, error);
     // Throw a more specific error message
    throw new Error(`Failed to delete habit: ${error.message}`);
  }
  console.log(`Service: Successfully deleted habit ${habitId}`);
  // No return value needed for successful delete (Promise<void>)
}

/**
 * Updates the sort order of habits by calling a Supabase RPC function.
 * @param orderedIds - An array of habit IDs in the desired new order.
 * @throws Error if Supabase client fails or a database error occurs during RPC call.
 */
export async function updateHabitOrder(orderedIds: string[]): Promise<void> {
  // Get Supabase client instance
  const supabase = getSupabaseClient();

  // --- Start Fix: Check if Supabase client initialized successfully ---
  if (!supabase) {
    console.error('Service Error (updateHabitOrder): Supabase client is null. Check environment configuration.');
    // Throw an error to be handled by the calling function
    throw new Error('Database connection failed.');
  }
  // --- End Fix ---
  console.log(`Service: Updating habit order via RPC for ${orderedIds.length} habits.`);

  // Prevent calling RPC if the array is empty
  if (orderedIds.length === 0) {
    console.log("Service: No ordered IDs provided, skipping update RPC call.");
    return; // Exit early
  }

  // Now safe to use supabase
  // Call the PostgreSQL function 'update_habit_order' via RPC
  const { error } = await supabase.rpc('update_habit_order', {
    // Pass the ordered IDs as the expected parameter 'ordered_ids'
    ordered_ids: orderedIds,
  });

  // Handle potential errors during the RPC call
  if (error) {
    console.error('Service Error: Failed to call update_habit_order RPC:', error);
     // Throw a more specific error message
    throw new Error(`Failed to save new habit order: ${error.message}`);
  }
  console.log("Service: Successfully updated habit order via RPC.");
   // No return value needed for successful RPC call (Promise<void>)
}
