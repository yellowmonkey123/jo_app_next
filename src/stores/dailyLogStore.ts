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
  markHabitDeferred: (habitId: string, sequenceType: 'startup' | 'shutdown') => Promise<void>;
  unmarkHabitDeferred: (habitId: string, sequenceType: 'startup' | 'shutdown') => Promise<void>;
  confirmDeferredHabit: (habitId: string, sequenceType: 'startup' | 'shutdown', didComplete: boolean) => void;
}

export const useDailyLogStore = create<DailyLogState>((set, get) => ({
  todayLog: null,
  yesterdayLog: null,
  loading: false,
  error: null,

  fetchLogs: async (userId: string, timezone: string) => {
    set({ loading: true, error: null });
    try {
      const now = new Date();
      const todayDateStr = getLocalDateString(now, timezone);
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yesterdayDateStr = getLocalDateString(yesterday, timezone);

      if (!todayDateStr || !yesterdayDateStr) {
        console.error("Failed to calculate necessary local date strings.", { todayDateStr, yesterdayDateStr });
        throw new Error("Failed to calculate local date strings.");
      }

      const [todayData, yesterdayData] = await Promise.all([
        getDailyLog(userId, todayDateStr),
        getDailyLog(userId, yesterdayDateStr),
      ]);

      set({
        todayLog: todayData,
        yesterdayLog: yesterdayData,
        loading: false,
      });
      console.log("Zustand Store: Logs fetched/updated.", { todayLog: todayData, yesterdayLog: yesterdayData });
    } catch (error) {
      console.error("Zustand Store: Error fetching logs:", error);
      set({
        error: error instanceof Error ? error.message : 'Failed to load daily logs.',
        loading: false,
        todayLog: null,
        yesterdayLog: null,
      });
    }
  },

  markHabitDeferred: async (habitId: string, sequenceType: 'startup' | 'shutdown') => {
    const currentTodayLog = get().todayLog;
    if (!currentTodayLog) {
      console.error("Zustand Store: Cannot mark habit deferred, todayLog is null.");
      return;
    }
    if (!currentTodayLog.id) {
      console.error("Zustand Store: Cannot update deferred status: todayLog ID is missing.");
      return;
    }

    const updatedDeferredStartup = [...(currentTodayLog.deferred_from_startup || [])];
    const updatedDeferredShutdown = [...(currentTodayLog.deferred_from_shutdown || [])];
    let needsUpdate = false;

    if (sequenceType === 'startup' && !updatedDeferredStartup.includes(habitId)) {
      updatedDeferredStartup.push(habitId);
      needsUpdate = true;
    } else if (sequenceType === 'shutdown' && !updatedDeferredShutdown.includes(habitId)) {
      updatedDeferredShutdown.push(habitId);
      needsUpdate = true;
    }

    if (!needsUpdate) {
      console.warn(`Zustand Store: Habit ${habitId} already marked as deferred for ${sequenceType} or invalid sequence type.`);
      return;
    }

    const updatedTodayLog = {
      ...currentTodayLog,
      deferred_from_startup: updatedDeferredStartup,
      deferred_from_shutdown: updatedDeferredShutdown,
    };
    set({ todayLog: updatedTodayLog });
    console.log(`Zustand Store: Optimistically marked habit ${habitId} as deferred from ${sequenceType}.`);

    try {
      await updateDailyLogDeferred(currentTodayLog.id, updatedDeferredStartup, updatedDeferredShutdown);
      console.log(`Zustand Store: DB update initiated for deferred habit ${habitId}.`);
    } catch (dbError) {
      console.error(`Zustand Store: Failed to save deferred habit ${habitId} to DB:`, dbError);
    }
  },

  unmarkHabitDeferred: async (habitId: string, sequenceType: 'startup' | 'shutdown') => {
    const currentTodayLog = get().todayLog;
    if (!currentTodayLog) {
      console.error("Zustand Store: Cannot unmark habit deferred, todayLog is null.");
      return;
    }
    if (!currentTodayLog.id) {
      console.error("Zustand Store: Cannot update deferred status: todayLog ID is missing.");
      return;
    }

    let updatedDeferredStartup = [...(currentTodayLog.deferred_from_startup || [])];
    let updatedDeferredShutdown = [...(currentTodayLog.deferred_from_shutdown || [])];
    let needsUpdate = false;
    let originalLength = 0;

    if (sequenceType === 'startup') {
      originalLength = updatedDeferredStartup.length;
      updatedDeferredStartup = updatedDeferredStartup.filter(id => id !== habitId);
      if (updatedDeferredStartup.length !== originalLength) {
        needsUpdate = true;
      }
    } else if (sequenceType === 'shutdown') {
      originalLength = updatedDeferredShutdown.length;
      updatedDeferredShutdown = updatedDeferredShutdown.filter(id => id !== habitId);
      if (updatedDeferredShutdown.length !== originalLength) {
        needsUpdate = true;
      }
    }

    if (!needsUpdate) {
      console.log(`Zustand Store: Habit ${habitId} was not in the deferred list for ${sequenceType}, no update needed.`);
      return;
    }

    const updatedTodayLog = {
      ...currentTodayLog,
      deferred_from_startup: updatedDeferredStartup,
      deferred_from_shutdown: updatedDeferredShutdown,
    };
    set({ todayLog: updatedTodayLog });
    console.log(`Zustand Store: Optimistically unmarked habit ${habitId} as deferred from ${sequenceType}.`);

    try {
      await updateDailyLogDeferred(currentTodayLog.id, updatedDeferredStartup, updatedDeferredShutdown);
      console.log(`Zustand Store: DB update initiated for unmarked deferred habit ${habitId}.`);
    } catch (dbError) {
      console.error(`Zustand Store: Failed to save unmarked deferred habit ${habitId} to DB:`, dbError);
    }
  },

  confirmDeferredHabit: (habitId: string, sequenceType: 'startup' | 'shutdown', didComplete: boolean) => {
    console.log(`Zustand Store: Confirming deferred habit ${habitId} from ${sequenceType}. Did complete: ${didComplete}`);
    const { todayLog, yesterdayLog } = get();

    if (sequenceType === 'startup' && todayLog?.deferred_from_startup?.includes(habitId)) {
      const updatedDeferred = todayLog.deferred_from_startup.filter(id => id !== habitId);
      set({ todayLog: { ...todayLog, deferred_from_startup: updatedDeferred } });
      console.log(`Zustand Store: Removed ${habitId} from today's deferred_from_startup list locally.`);
    } else if (sequenceType === 'shutdown' && yesterdayLog?.deferred_from_shutdown?.includes(habitId)) {
      const updatedDeferred = yesterdayLog.deferred_from_shutdown.filter(id => id !== habitId);
      set({ yesterdayLog: { ...yesterdayLog, deferred_from_shutdown: updatedDeferred } });
      console.log(`Zustand Store: Removed ${habitId} from yesterday's deferred_from_shutdown list locally.`);
    } else {
      console.warn(`Zustand Store: Could not find habit ${habitId} in the expected deferred list for ${sequenceType} to confirm/remove.`);
    }
  },
}));