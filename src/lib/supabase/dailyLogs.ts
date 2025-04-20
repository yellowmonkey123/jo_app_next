// src/lib/supabase/dailyLogs.ts
import { getSupabaseClient } from '@/lib/supabase/supabaseClient';
import { DailyLog } from '@/types';

export async function getDailyLog(userId: string, dateString: string): Promise<DailyLog | null> {
  const supabase = getSupabaseClient();
  console.log(`Service: Fetching daily log for user ${userId} on date ${dateString}`);
  const { data, error } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('log_date', dateString)
    .maybeSingle();

  if (error) {
    console.error(`Service Error: Failed to fetch daily log for ${userId} on ${dateString}:`, error);
    throw new Error(`Failed to fetch daily log: ${error.message}`);
  }

  console.log(`Service: Daily log for ${dateString} ${data ? 'found' : 'not found'}.`);
  return data;
}

export async function updateDailyLogDeferred(
  logId: string,
  deferredStartupIds: string[] | null,
  deferredShutdownIds: string[] | null
): Promise<void> {
  const supabase = getSupabaseClient();
  console.log(`Service: Updating deferred habits for log ${logId}`);
  const { error } = await supabase
    .from('daily_logs')
    .update({
      deferred_from_startup: deferredStartupIds,
      deferred_from_shutdown: deferredShutdownIds,
      updated_at: new Date().toISOString(),
    })
    .eq('id', logId);

  if (error) {
    console.error(`Service Error: Failed to update deferred habits for log ${logId}:`, error);
    throw new Error(`Failed to update deferred habits: ${error.message}`);
  }

  console.log(`Service: Successfully updated deferred habits for log ${logId}.`);
}