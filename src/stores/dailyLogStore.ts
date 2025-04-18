// src/stores/dailyLogStore.ts

import { create } from 'zustand';
import { DailyLog } from '@/types'; // Import your updated DailyLog type
// Import your service functions for interacting with Supabase
import { getDailyLog, updateDailyLogDeferred } from '@/lib/supabase/dailyLogs';
// Assuming getLocalDateString is NOT imported from utils, define it here or ensure import works
// import { getLocalDateString } from '@/lib/utils/dateUtils';

// Helper function (defined here if not imported reliably)
// Consider moving to utils if used elsewhere and ensure import works
function getLocalDateString(date: Date, timezone: string): string {
    try {
        // 'en-CA' locale often gives YYYY-MM-DD format
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
        });
        return formatter.format(date);
    } catch (e) {
        console.error(`Failed to format date for timezone ${timezone}:`, e);
        // Fallback to UTC date string
        return date.toISOString().split('T')[0];
    }
}


// Interface defining the state structure and actions
interface DailyLogState {
  todayLog: DailyLog | null;
  yesterdayLog: DailyLog | null;
  loading: boolean;
  error: string | null;
  fetchLogs: (userId: string, timezone: string) => Promise<void>;
  markHabitDeferred: (habitId: string, sequenceType: 'startup' | 'shutdown') => Promise<void>;
  unmarkHabitDeferred: (habitId: string, sequenceType: 'startup' | 'shutdown') => Promise<void>; // Added action
  confirmDeferredHabit: (habitId: string, sequenceType: 'startup' | 'shutdown', didComplete: boolean) => void;
}

// Create the Zustand store
export const useDailyLogStore = create<DailyLogState>((set, get) => ({
  // --- Initial State ---
  todayLog: null,
  yesterdayLog: null,
  loading: false,
  error: null,

  // --- Actions ---

  /**
   * Fetches today's and yesterday's logs for the given user and timezone.
   * Includes the fix for yesterday's date calculation.
   */
  fetchLogs: async (userId: string, timezone: string) => {
    set({ loading: true, error: null }); // Set loading state, clear errors
    try {
      const now = new Date(); // Get current time once

      // Calculate today's date string
      const todayDateStr = getLocalDateString(now, timezone); // Pass 'now'

      // Calculate yesterday's date string
      const yesterday = new Date(now); // Clone 'now'
      yesterday.setDate(now.getDate() - 1); // Set to yesterday
      const yesterdayDateStr = getLocalDateString(yesterday, timezone); // Pass 'yesterday'

      if (!todayDateStr || !yesterdayDateStr) {
          // Added error handling for date string calculation failure
          console.error("Failed to calculate necessary local date strings.", {todayDateStr, yesterdayDateStr});
          throw new Error("Failed to calculate local date strings.");
      }


      // Fetch logs using service functions
      // Use Promise.all to fetch concurrently
      const [todayData, yesterdayData] = await Promise.all([
        getDailyLog(userId, todayDateStr),
        getDailyLog(userId, yesterdayDateStr)
      ]);

      set({
        todayLog: todayData, // Will be null if no log exists for today
        yesterdayLog: yesterdayData, // Will be null if no log exists for yesterday
        loading: false,
      });
      console.log("Zustand Store: Logs fetched/updated.", { todayLog: todayData, yesterdayLog: yesterdayData }); // Updated log key

    } catch (error) {
      console.error("Zustand Store: Error fetching logs:", error);
      set({
        error: error instanceof Error ? error.message : 'Failed to load daily logs.',
        loading: false,
        todayLog: null, // Clear logs on error
        yesterdayLog: null,
      });
    }
  },

  /**
   * Marks a habit as deferred for today's log and attempts to save to DB.
   */
  markHabitDeferred: async (habitId: string, sequenceType: 'startup' | 'shutdown') => {
    const currentTodayLog = get().todayLog;
    if (!currentTodayLog) {
      console.error("Zustand Store: Cannot mark habit deferred, todayLog is null.");
      return;
    }
    // Ensure log ID exists before attempting update
    if (!currentTodayLog.id) {
       console.error("Zustand Store: Cannot update deferred status: todayLog ID is missing.");
       // Potentially set an error state or throw
       return;
    }


    const updatedDeferredStartup = [...(currentTodayLog.deferred_from_startup || [])];
    const updatedDeferredShutdown = [...(currentTodayLog.deferred_from_shutdown || [])];
    let needsUpdate = false; // Flag to check if an update is actually needed

    // Add the habit ID to the correct array, avoiding duplicates
    if (sequenceType === 'startup' && !updatedDeferredStartup.includes(habitId)) {
      updatedDeferredStartup.push(habitId);
      needsUpdate = true;
    } else if (sequenceType === 'shutdown' && !updatedDeferredShutdown.includes(habitId)) {
      updatedDeferredShutdown.push(habitId);
      needsUpdate = true;
    }

    if (!needsUpdate) {
        console.warn(`Zustand Store: Habit ${habitId} already marked as deferred for ${sequenceType} or invalid sequence type.`);
        return; // Already deferred or invalid sequence type
    }

    // Optimistically update the local state
    const updatedTodayLog = {
        ...currentTodayLog,
        deferred_from_startup: updatedDeferredStartup,
        deferred_from_shutdown: updatedDeferredShutdown,
    };
    set({ todayLog: updatedTodayLog });
    console.log(`Zustand Store: Optimistically marked habit ${habitId} as deferred from ${sequenceType}.`);

    // Asynchronously update the database
    try {
        await updateDailyLogDeferred(currentTodayLog.id, updatedDeferredStartup, updatedDeferredShutdown);
        console.log(`Zustand Store: DB update initiated for deferred habit ${habitId}.`);
    } catch (dbError) {
        console.error(`Zustand Store: Failed to save deferred habit ${habitId} to DB:`, dbError);
        // Optional: Revert optimistic update or set an error state here
        // set({ todayLog: currentTodayLog, error: "Failed to save deferred status." });
    }
  },

  /**
   * Removes a habit from the deferred list for today's log and attempts to save to DB.
   */
  unmarkHabitDeferred: async (habitId: string, sequenceType: 'startup' | 'shutdown') => {
    const currentTodayLog = get().todayLog;
    if (!currentTodayLog) {
      console.error("Zustand Store: Cannot unmark habit deferred, todayLog is null.");
      return;
    }
     // Ensure log ID exists before attempting update
    if (!currentTodayLog.id) {
       console.error("Zustand Store: Cannot update deferred status: todayLog ID is missing.");
       return;
    }

    let updatedDeferredStartup = [...(currentTodayLog.deferred_from_startup || [])];
    let updatedDeferredShutdown = [...(currentTodayLog.deferred_from_shutdown || [])];
    let needsUpdate = false; // Flag to check if an update is actually needed
    let originalLength = 0;

    // Remove the habit ID from the correct array if it exists
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
        return; // Habit wasn't deferred in this list
    }

    // Optimistically update the local state
    const updatedTodayLog = {
        ...currentTodayLog,
        deferred_from_startup: updatedDeferredStartup,
        deferred_from_shutdown: updatedDeferredShutdown,
    };
    set({ todayLog: updatedTodayLog });
    console.log(`Zustand Store: Optimistically unmarked habit ${habitId} as deferred from ${sequenceType}.`);

    // Asynchronously update the database
    try {
        await updateDailyLogDeferred(currentTodayLog.id, updatedDeferredStartup, updatedDeferredShutdown);
        console.log(`Zustand Store: DB update initiated for unmarked deferred habit ${habitId}.`);
    } catch (dbError) {
        console.error(`Zustand Store: Failed to save unmarked deferred habit ${habitId} to DB:`, dbError);
        // Optional: Revert optimistic update or set an error state here
        // set({ todayLog: currentTodayLog, error: "Failed to save deferred status removal." });
    }
  },

  /**
   * Placeholder action for handling confirmation of deferred habits.
   * Removes the habit from the relevant deferred list in the local state.
   */
  confirmDeferredHabit: (habitId: string, sequenceType: 'startup' | 'shutdown', didComplete: boolean) => {
    console.log(`Zustand Store: Confirming deferred habit ${habitId} from ${sequenceType}. Did complete: ${didComplete}`);
    // TODO: Decide if/how to persist the *completion status* (didComplete) to the database.
    // Current implementation only removes from the deferred list locally upon confirmation.

    const { todayLog, yesterdayLog } = get();

    // If confirming deferred from STARTUP (in Shutdown step): remove from todayLog.deferred_from_startup
    if (sequenceType === 'startup' && todayLog?.deferred_from_startup?.includes(habitId)) {
        const updatedDeferred = todayLog.deferred_from_startup.filter(id => id !== habitId);
        set({ todayLog: { ...todayLog, deferred_from_startup: updatedDeferred } });
        console.log(`Zustand Store: Removed ${habitId} from today's deferred_from_startup list locally.`);
    }
    // If confirming deferred from SHUTDOWN (in Startup step): remove from yesterdayLog.deferred_from_shutdown
    else if (sequenceType === 'shutdown' && yesterdayLog?.deferred_from_shutdown?.includes(habitId)) {
        const updatedDeferred = yesterdayLog.deferred_from_shutdown.filter(id => id !== habitId);
        set({ yesterdayLog: { ...yesterdayLog, deferred_from_shutdown: updatedDeferred } });
         console.log(`Zustand Store: Removed ${habitId} from yesterday's deferred_from_shutdown list locally.`);
    } else {
         console.warn(`Zustand Store: Could not find habit ${habitId} in the expected deferred list for ${sequenceType} to confirm/remove.`);
    }
  },

}));