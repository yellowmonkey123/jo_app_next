// src/lib/supabase/habits.ts
import { getSupabaseClient } from '@/lib/supabase/supabaseClient';
import { Habit } from '@/types';

export async function getHabitsForUser(userId: string): Promise<Habit[]> {
  const supabase = getSupabaseClient();
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
  return data || [];
}

export async function deleteHabitById(habitId: string): Promise<void> {
  const supabase = getSupabaseClient();
  console.log(`Service: Deleting habit ${habitId}`);
  const { error } = await supabase
    .from('habits')
    .delete()
    .eq('id', habitId);

  if (error) {
    console.error(`Service Error: Failed to delete habit ${habitId}:`, error);
    throw new Error(`Failed to delete habit: ${error.message}`);
  }
  console.log(`Service: Successfully deleted habit ${habitId}`);
}

export async function updateHabitOrder(orderedIds: string[]): Promise<void> {
  const supabase = getSupabaseClient();
  console.log(`Service: Updating habit order via RPC for ${orderedIds.length} habits.`);
  if (orderedIds.length === 0) {
    console.log("Service: No ordered IDs provided, skipping update.");
    return;
  }

  const { error } = await supabase.rpc('update_habit_order', {
    ordered_ids: orderedIds,
  });

  if (error) {
    console.error('Service Error: Failed to call update_habit_order RPC:', error);
    throw new Error(`Failed to save new order: ${error.message}`);
  }
  console.log("Service: Successfully updated habit order via RPC.");
}