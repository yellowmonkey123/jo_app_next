// ───────────────────────────────────────────────────────────────────────────
// src/lib/supabase/dailyLogs.ts
// ───────────────────────────────────────────────────────────────────────────
import { getSupabaseClient } from '@/lib/supabase/supabaseClient';
import { DailyLog } from '@/types';

/*─────────────────────────────────────────────────────────────────────────────
  getDailyLog – unchanged
─────────────────────────────────────────────────────────────────────────────*/
export async function getDailyLog(
  userId: string,
  dateString: string
): Promise<DailyLog | null> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Database connection failed.');

  const { data, error } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('log_date', dateString)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch daily log: ${error.message}`);
  return data as DailyLog | null;
}

/*─────────────────────────────────────────────────────────────────────────────
  updateDailyLogDeferred
  –  now accepts TWO OPTIONAL extra parameters so we can persist
     completed_am_habits / completed_pm_anytime_habits when needed.
─────────────────────────────────────────────────────────────────────────────*/
export async function updateDailyLogDeferred(
  logId: string,
  deferredStartupIds: string[] | null,
  deferredShutdownIds: string[] | null,
  completedAmIds: string[] | undefined = undefined,          // ← NEW
  completedPmAnyIds: string[] | undefined = undefined        // ← NEW
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Database connection failed.');

  // Build patch with only the columns we were asked to touch
  const updatePayload: Record<string, any> = {
    deferred_from_startup: deferredStartupIds,
    deferred_from_shutdown: deferredShutdownIds,
    updated_at: new Date().toISOString(),
  };

  if (completedAmIds    !== undefined)
    updatePayload.completed_am_habits = completedAmIds;            // ← NEW
  if (completedPmAnyIds !== undefined)
    updatePayload.completed_pm_anytime_habits = completedPmAnyIds; // ← NEW

  const { error } = await supabase
    .from('daily_logs')
    .update(updatePayload)
    .eq('id', logId);

  if (error) throw new Error(`Failed to update daily log: ${error.message}`);
}
