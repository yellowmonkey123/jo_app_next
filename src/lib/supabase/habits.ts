// 1. Create this new file: src/lib/supabase/habits.ts
//    (Make sure your supabase client is correctly initialized and exported from '@/lib/supabase/client')

import { supabase } from './client'; // Adjust path if your client is elsewhere
import { Habit } from '@/types';

/**
 * Fetches all habits for a specific user, ordered by timing and sort_order.
 * @param userId - The UUID of the user whose habits to fetch.
 * @returns Promise<Habit[]> - An array of habit objects.
 * @throws Will throw an error if the Supabase query fails.
 */
export async function getHabitsForUser(userId: string): Promise<Habit[]> {
  console.log(`Service: Fetching habits for user ${userId}`);
  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .eq('user_id', userId)
    .order('timing', { ascending: true })
    .order('sort_order', { ascending: true, nullsFirst: false });

  if (error) {
    console.error('Service Error: Failed to fetch habits:', error);
    throw new Error(`Failed to fetch habits: ${error.message}`);
  }

  console.log(`Service: Fetched ${data?.length ?? 0} habits.`);
  return data || []; // Return fetched data or empty array
}

/**
 * Deletes a specific habit by its ID.
 * @param habitId - The UUID of the habit to delete.
 * @returns Promise<void>
 * @throws Will throw an error if the Supabase delete operation fails.
 */
export async function deleteHabitById(habitId: string): Promise<void> {
    console.log(`Service: Deleting habit ${habitId}`);
    const { error } = await supabase
        .from('habits')
        .delete()
        .eq('id', habitId);

    if (error) {
        console.error(`Service Error: Failed to delete habit ${habitId}:`, error);
        // It's important to throw here so the calling component knows it failed
        throw new Error(`Failed to delete habit: ${error.message}`);
    }
    console.log(`Service: Successfully deleted habit ${habitId}`);
}

/**
 * Updates the sort order for a list of habits using an RPC function.
 * @param orderedIds - An array of habit UUIDs in the desired new order.
 * @returns Promise<void>
 * @throws Will throw an error if the Supabase RPC call fails.
 */
export async function updateHabitOrder(orderedIds: string[]): Promise<void> {
    console.log(`Service: Updating habit order via RPC for ${orderedIds.length} habits.`);
    if (orderedIds.length === 0) {
        console.log("Service: No ordered IDs provided, skipping update.");
        return; // Nothing to do
    }

    const { error } = await supabase.rpc('update_habit_order', {
      ordered_ids: orderedIds // Pass the argument object expected by the RPC function
    });

    if (error) {
        console.error('Service Error: Failed to call update_habit_order RPC:', error);
        throw new Error(`Failed to save new order: ${error.message}`);
    }
    console.log("Service: Successfully updated habit order via RPC.");
}

