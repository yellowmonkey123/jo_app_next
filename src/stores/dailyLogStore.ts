// src/stores/dailyLogStore.ts
import { create } from 'zustand';
import { DailyLog } from '@/types';
import { getDailyLog, updateDailyLogDeferred } from '@/lib/supabase/dailyLogs';
import { getLocalDateString } from '@/lib/utils/dateUtils';

interface DailyLogState {
  todayLog: DailyLog | null;
  yesterdayLog: DailyLog | null;
  loading: boolean;
  error: string | null;
  fetchLogs: (userId: string, timezone: string) => Promise<void>;
  markHabitDeferred: (
    habitId: string,
    sequenceType: 'startup' | 'shutdown'
  ) => Promise<void>;
  unmarkHabitDeferred: (
    habitId: string,
    sequenceType: 'startup' | 'shutdown'
  ) => Promise<void>;
  confirmDeferredHabit: (
    habitId: string,
    sequenceType: 'startup' | 'shutdown',
    didComplete: boolean
  ) => Promise<void>;
}

export const useDailyLogStore = create<DailyLogState>((set, get) => ({
  todayLog: null,
  yesterdayLog: null,
  loading: false,
  error: null,

  /* ──────────────────────────────────────────────────────────
   * GET TODAY + YESTERDAY LOGS
   * ────────────────────────────────────────────────────────*/
  fetchLogs: async (userId: string, timezone: string) => {
    set({ loading: true, error: null });
    try {
      const todayDateStr = getLocalDateString(timezone);
      const yesterdayDateStr = getLocalDateString(timezone, { days: -1 });

      if (!todayDateStr || !yesterdayDateStr) {
        throw new Error('Failed to calculate local date strings');
      }

      const [todayData, yesterdayData] = await Promise.all([
        getDailyLog(userId, todayDateStr),
        getDailyLog(userId, yesterdayDateStr),
      ]);

      set({ todayLog: todayData, yesterdayLog: yesterdayData, loading: false });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load daily logs',
        todayLog: null,
        yesterdayLog: null,
      });
    }
  },

  /* ──────────────────────────────────────────────────────────
   * MARK DEFERRED
   * ────────────────────────────────────────────────────────*/
  markHabitDeferred: async (habitId, sequenceType) => {
    // Create a stub log if none exists yet so UI can still react
    let todayLog = get().todayLog;
    if (!todayLog) {
      todayLog = {
        id: undefined,
        deferred_from_startup: [],
        deferred_from_shutdown: [],
      } as unknown as DailyLog;
    }

    const updatedStartup = [...(todayLog.deferred_from_startup ?? [])];
    const updatedShutdown = [...(todayLog.deferred_from_shutdown ?? [])];

    let needsUpdate = false;
    if (sequenceType === 'startup' && !updatedStartup.includes(habitId)) {
      updatedStartup.push(habitId);
      needsUpdate = true;
    }
    if (sequenceType === 'shutdown' && !updatedShutdown.includes(habitId)) {
      updatedShutdown.push(habitId);
      needsUpdate = true;
    }
    if (!needsUpdate) return;

    // optimistic update
    set({
      todayLog: {
        ...todayLog,
        deferred_from_startup: updatedStartup,
        deferred_from_shutdown: updatedShutdown,
      },
    });

    // If the row doesn't exist yet (e.g. before Startup submit) skip DB write
    if (!todayLog.id) return;

    try {
      await updateDailyLogDeferred(todayLog.id, updatedStartup, updatedShutdown);
    } catch (e) {
      console.error('Failed to persist deferred habit', e);
    }
  },

  /* ──────────────────────────────────────────────────────────
   * UN‑MARK DEFERRED
   * ────────────────────────────────────────────────────────*/
  unmarkHabitDeferred: async (habitId, sequenceType) => {
    const cur = get().todayLog;
    if (!cur || !cur.id) return;

    const updatedStartup = cur.deferred_from_startup?.filter(id => id !== habitId) ?? [];
    const updatedShutdown = cur.deferred_from_shutdown?.filter(id => id !== habitId) ?? [];

    set({ todayLog: { ...cur, deferred_from_startup: updatedStartup, deferred_from_shutdown: updatedShutdown } });

    try {
      await updateDailyLogDeferred(cur.id, updatedStartup, updatedShutdown);
    } catch (e) {
      console.error('Failed to persist un‑defer', e);
    }
  },

  /* ──────────────────────────────────────────────────────────
   * CONFIRM DEFERRED HABIT DURING OTHER ROUTINE
   * ────────────────────────────────────────────────────────*/
  confirmDeferredHabit: async (habitId, sequenceType, didComplete) => {
    const { todayLog, yesterdayLog } = get();

    const isStartup = sequenceType === 'startup';
    const log = isStartup ? todayLog : yesterdayLog;
    if (!log || !log.id) return;

    const deferredKey = isStartup ? 'deferred_from_startup' : 'deferred_from_shutdown';
    const completedKey = isStartup ? 'completed_am_habits' : 'completed_pm_anytime_habits';

    const newDeferred = (log[deferredKey] || []).filter(id => id !== habitId);
    let newCompleted = log[completedKey] || [];

    if (didComplete) {
      if (!newCompleted.includes(habitId)) newCompleted = [...newCompleted, habitId];
    } else {
      newCompleted = newCompleted.filter(id => id !== habitId);
    }

    // optimistic update
    set({
      [isStartup ? 'todayLog' : 'yesterdayLog']: {
        ...log,
        [deferredKey]: newDeferred,
        [completedKey]: newCompleted,
      },
    } as any);

    try {
      await updateDailyLogDeferred(
        log.id,
        isStartup ? newDeferred : (todayLog?.deferred_from_startup ?? []),
        !isStartup ? newDeferred : (todayLog?.deferred_from_shutdown ?? []),
        isStartup ? newCompleted : undefined,
        !isStartup ? newCompleted : undefined
      );
    } catch (e) {
      console.error('Failed to persist confirmDeferredHabit', e);
    }
  },
}))
