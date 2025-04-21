'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
// Import Supabase client function
import { getSupabaseClient } from '@/lib/supabase/supabaseClient';
// Assuming types are correctly defined
import { Habit, HabitTiming, ShutdownFormData } from '@/types';
// Assuming this service function exists
import { getHabitsForUser } from '@/lib/supabase/habits';
// Import Zustand store hook
import { useDailyLogStore } from '@/stores/dailyLogStore';
// Import icons
import { CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
// Import common components
import { LoadingOverlay } from '@/components/common/LoadingOverlay'; // Assuming this exists

// Props interface for the component
interface PmHabitsStepProps {
  initialValue: string[]; // Array of initially *completed* habit IDs for this load (passed from parent)
  onNext: (data: Partial<ShutdownFormData>) => void; // Callback to proceed to next step
  onBack: () => void; // Callback to go back
}

export default function PmHabitsStep({ initialValue, onNext, onBack }: PmHabitsStepProps) {
  // --- State ---
  // State to hold the details of available PM/Anytime habits
  const [availableHabits, setAvailableHabits] = useState<Habit[]>([]);
  // Local state to track habits marked "Done" *within this component instance*
  const [doneHabitIds, setDoneHabitIds] = useState<Set<string>>(new Set(initialValue));
  // Loading state for fetching habits
  const [loading, setLoading] = useState(true);
  // Error state for fetching habits
  const [error, setError] = useState<string | null>(null);

  // --- Zustand Store Access ---
  // Actions to mark/unmark habits as deferred in the central store
  const markHabitDeferred = useDailyLogStore((state) => state.markHabitDeferred);
  const unmarkHabitDeferred = useDailyLogStore((state) => state.unmarkHabitDeferred);

  // Select the raw array of deferred IDs from the store's todayLog
  const deferredShutdownArray = useDailyLogStore((state) => state.todayLog?.deferred_from_shutdown);
  // Use useMemo to create a stable Set of deferred IDs based on the store array
  // This prevents unnecessary re-renders if the array reference changes but content is the same
  const deferredHabitIds = useMemo(() => new Set(deferredShutdownArray ?? []), [deferredShutdownArray]);

  // --- Data Fetching ---
  // Effect hook to fetch relevant PM and Anytime habits when the component mounts
  useEffect(() => {
    const fetchPmHabits = async () => {
      console.log("PmHabitsStep: useEffect triggered, fetching habits...");
      setLoading(true);
      setError(null);
      setAvailableHabits([]); // Clear previous habits

      try {
        // Get Supabase client instance
        const supabase = getSupabaseClient();

        // --- Start Fix: Check if Supabase client initialized successfully ---
        if (!supabase) {
            console.error('PmHabitsStep: Supabase client is null. Check environment configuration.');
            // Throw an error to be handled by the catch block below
            throw new Error('Database connection failed. Please check setup or try again later.');
        }
        // --- End Fix ---
        console.log('PmHabitsStep: Supabase client validated.');

        // 1. Ensure user is available before fetching habits
        console.log('PmHabitsStep: Fetching user...');
        // supabase is guaranteed non-null here
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        // Handle auth errors or no user
        if (authError || !user) {
          console.error('PmHabitsStep: Auth error or user not found:', authError);
          throw new Error("User not authenticated. Cannot fetch habits.");
        }
        console.log('PmHabitsStep: Fetched user:', user.id);

        // 2. Use the service function to get all habits for the user
        // Assuming getHabitsForUser handles its own client or checks it
        const allHabits = await getHabitsForUser(user.id);
        console.log('PmHabitsStep: Fetched total habits:', allHabits.length);

        // 3. Filter for PM and Anytime habits specifically within this component
        const pmAnytimeHabits = allHabits.filter(
          h => h.timing === HabitTiming.PM || h.timing === HabitTiming.ANYTIME
        );
        // Sort habits based on their sort_order, handling nulls
        pmAnytimeHabits.sort((a, b) => (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity));

        setAvailableHabits(pmAnytimeHabits); // Update state with filtered & sorted habits
        console.log('PmHabitsStep: Filtered and set PM/Anytime habits:', pmAnytimeHabits.map(h=>h.id));

      } catch (err: unknown) {
        // Catch errors from client init, auth, or habit fetching
        console.error("PmHabitsStep: Error fetching PM/Anytime habits:", err);
        setError(err instanceof Error ? err.message : "Failed to load evening/anytime habits.");
        setAvailableHabits([]); // Clear habits on error
      } finally {
        // Ensure loading state is turned off
        setLoading(false);
        console.log("PmHabitsStep: Fetch habits process finished.");
      }
    };
    // Execute the fetch function
    fetchPmHabits();
  }, []); // Empty dependency array ensures this runs only once on mount

  // Effect hook to synchronize local 'done' state if the initialValue prop changes
  // This might happen if the parent component re-renders with new initial data
  useEffect(() => {
    console.log("PmHabitsStep: initialValue prop changed, updating local done set:", initialValue);
    setDoneHabitIds(new Set(initialValue));
  }, [initialValue]);

  // --- Button Handlers ---

  /**
   * Handles clicking the "Done" (CheckCircleIcon) button for a habit.
   * Adds the habit ID to the local 'done' set.
   * If the habit was previously marked as deferred (in the Zustand store), it removes it from the store's deferred list.
   */
  const handleMarkDone = useCallback((habitId: string) => {
    console.log(`PmHabitsStep: Marking habit ${habitId} as Done locally.`);
    // Update local "Done" state FIRST
    setDoneHabitIds(prevIds => {
      const newIds = new Set(prevIds);
      newIds.add(habitId);
      return newIds;
    });

    // Check if this habit ID exists in the deferred set derived from the store
    if (deferredHabitIds.has(habitId)) {
      console.log(`PmHabitsStep: Unmarking deferred habit ${habitId} in store because it was marked Done.`);
      // Call store action to remove from the 'deferred_from_shutdown' list
      unmarkHabitDeferred(habitId, 'shutdown');
    }
  }, [deferredHabitIds, unmarkHabitDeferred]); // Dependencies for useCallback

  /**
   * Handles clicking the "Do Later" (ClockIcon) button for a habit.
   * Removes the habit ID from the local 'done' set (if it was there).
   * Adds the habit ID to the store's 'deferred_from_shutdown' list.
   */
  const handleMarkDeferredClick = useCallback((habitId: string) => {
    console.log(`PmHabitsStep: Marking habit ${habitId} as Deferred.`);
    // Update local "Done" state FIRST (remove if it was marked done)
    setDoneHabitIds(prevIds => {
      const newIds = new Set(prevIds);
      newIds.delete(habitId);
      return newIds;
    });

    // Call the store action to add to the 'deferred_from_shutdown' list
    markHabitDeferred(habitId, 'shutdown');
  }, [markHabitDeferred]); // Dependency for useCallback

  /**
   * Handles clicking the final "Complete Shutdown" button.
   * Gathers the IDs from the local 'done' set and passes them to the parent via onNext.
   */
  const handleCompleteClick = useCallback(() => {
    // Convert the local Set of done IDs to an array
    const completedHabitsArray = Array.from(doneHabitIds);
    console.log("PmHabitsStep: Completing step, passing done habits to parent:", completedHabitsArray);
    // Call the parent's onNext callback with the relevant part of the form data
    onNext({ completed_pm_anytime_habits: completedHabitsArray });
  }, [doneHabitIds, onNext]); // Dependencies for useCallback

  // --- Helper functions for styling (could be moved to utils if used elsewhere) ---
  const getTimingLabel = (timing: HabitTiming): string => {
    switch (timing) {
      case HabitTiming.AM: return 'Morning';
      case HabitTiming.PM: return 'Evening';
      case HabitTiming.ANYTIME: return 'Anytime';
      default: return String(timing); // Fallback
    }
  };

  const getTimingColor = (timing: HabitTiming): string => {
    switch (timing) {
      case HabitTiming.AM: return 'bg-yellow-100 text-yellow-800';
      case HabitTiming.PM: return 'bg-blue-100 text-blue-800';
      case HabitTiming.ANYTIME: return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // --- Render Logic ---
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Completed PM & Anytime Habits</h2>
      <p className="text-sm text-gray-600">
        Mark your evening & anytime habits as &quot;Done&quot; or &quot;Do Later&quot;. Habits marked &quot;Do Later&quot; will be added to your deferred list for potential completion tomorrow.
      </p>

      {/* Container for the list of habits */}
      <div className="space-y-3 max-h-60 overflow-y-auto border border-gray-200 rounded-md p-4 bg-white shadow-sm">
        {/* Loading State */}
        {loading && (
            <div className="flex items-center justify-center py-4">
                <LoadingOverlay />
                <span className="ml-2 text-gray-500 text-sm">Loading habits...</span>
            </div>
        )}
        {/* Error State */}
        {error && <p className="text-red-600 text-center py-4 text-sm">Error: {error}</p>}
        {/* Empty State */}
        {!loading && !error && availableHabits.length === 0 && (
          <p className="text-gray-500 text-center py-4 italic text-sm">No relevant PM or Anytime habits found. You can add habits in the &apos;Manage Habits&apos; section.</p>
        )}

        {/* Habit List - Render only if not loading, no error, and habits exist */}
        {!loading && !error && availableHabits.length > 0 && (
          availableHabits.map((habit) => {
            // Determine current status based on local 'done' state and store's 'deferred' state
            const isDoneLocally = doneHabitIds.has(habit.id);
            const isDeferredInStore = deferredHabitIds.has(habit.id);
            // Display as deferred if it's in the store's list AND not marked done locally in this session
            const displayDeferred = isDeferredInStore && !isDoneLocally;
            // Display as done if marked done locally in this session
            const displayDone = isDoneLocally;

            return (
              <div key={habit.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                {/* Habit Name & Timing Badge */}
                <div>
                  <span className={`text-sm font-medium ${displayDeferred ? 'text-gray-400 italic line-through' : 'text-gray-900'}`}>
                    {habit.name}
                  </span>
                  {/* Display timing badge */}
                  <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTimingColor(habit.timing)}`}>
                    {getTimingLabel(habit.timing)}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-2 flex-shrink-0">
                  {/* "Do Later" Button */}
                  <button
                    type="button"
                    onClick={() => handleMarkDeferredClick(habit.id)}
                    title="Mark as 'Do Later' (Defer)"
                    // Style based on deferred status, disable if marked done locally
                    className={`p-1.5 rounded-full transition-colors duration-150 ease-in-out ${
                        displayDeferred
                        ? 'bg-orange-100 text-orange-600 ring-1 ring-orange-300' // Deferred style
                        : 'text-gray-400 hover:text-orange-500 hover:bg-orange-50' // Default style
                    } ${displayDone ? 'opacity-30 cursor-not-allowed' : ''}`} // Disabled style if done
                    disabled={displayDone} // Prevent deferring if marked done locally
                  >
                    <ClockIcon className="h-5 w-5" />
                  </button>

                  {/* "Done" Button */}
                  <button
                    type="button"
                    onClick={() => handleMarkDone(habit.id)}
                    title="Mark as 'Done'"
                    // Style based only on local 'done' status
                    className={`p-1.5 rounded-full transition-colors duration-150 ease-in-out ${
                        displayDone
                        ? 'bg-green-100 text-green-600 ring-1 ring-green-300' // Done style
                        : 'text-gray-400 hover:text-green-500 hover:bg-green-50' // Default style
                    }`}
                  >
                    <CheckCircleIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-6">
        {/* Back Button */}
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Back
        </button>
        {/* Complete Shutdown Button */}
        <button
          type="button"
          onClick={handleCompleteClick}
          // Disable button if still loading habits or if there was an error fetching
          disabled={loading || !!error}
          className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          Complete Shutdown
        </button>
      </div>
    </div>
  );
}