'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
// Import Supabase client function
import { getSupabaseClient } from '@/lib/supabase/supabaseClient';
// Assuming types are correctly defined
import { Habit, HabitTiming, StartupFormData } from '@/types';
// Assuming this service function exists
import { getHabitsForUser } from '@/lib/supabase/habits';
// Import Zustand store hook
import { useDailyLogStore } from '@/stores/dailyLogStore';
// Import icons
import { CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
// Import common components
import { LoadingOverlay } from '@/components/common/LoadingOverlay'; // Assuming this exists

// Props interface for the component
interface AmHabitsStepProps {
  initialValue: string[]; // Array of initially *completed* habit IDs for this load (passed from parent)
  onNext: (data: Partial<StartupFormData>) => void; // Callback to proceed to next step
  onBack: () => void; // Callback to go back
}

export default function AmHabitsStep({ initialValue, onNext, onBack }: AmHabitsStepProps) {
  // --- State ---
  // State to hold the details of available AM habits
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
  const deferredStartupArray = useDailyLogStore((state) => state.todayLog?.deferred_from_startup);
  // Use useMemo to create a stable Set of deferred IDs based on the store array
  const deferredHabitIds = useMemo(() => new Set(deferredStartupArray ?? []), [deferredStartupArray]);

  // --- Data Fetching ---
  // Effect hook to fetch relevant AM habits when the component mounts
  useEffect(() => {
    const fetchAmHabits = async () => {
      console.log("AmHabitsStep: useEffect triggered, fetching habits...");
      setLoading(true);
      setError(null);
      setAvailableHabits([]); // Clear previous habits

      try {
        // Get Supabase client instance
        const supabase = getSupabaseClient();

        // --- Start Fix: Check if Supabase client initialized successfully ---
        if (!supabase) {
            console.error('AmHabitsStep: Supabase client is null. Check environment configuration.');
            // Throw an error to be handled by the catch block below
            throw new Error('Database connection failed. Please check setup or try again later.');
        }
        // --- End Fix ---
        console.log('AmHabitsStep: Supabase client validated.');

        // 1. Ensure user is available before fetching habits
        console.log('AmHabitsStep: Fetching user...');
        // supabase is guaranteed non-null here
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        // Handle auth errors or no user
        if (authError || !user) {
          console.error('AmHabitsStep: Auth error or user not found:', authError);
          throw new Error("User not authenticated. Cannot fetch habits.");
        }
        console.log('AmHabitsStep: Fetched user:', user.id);

        // 2. Use the service function to get all habits for the user
        // Assuming getHabitsForUser handles its own client or checks it
        const allHabits = await getHabitsForUser(user.id);
        console.log('AmHabitsStep: Fetched total habits:', allHabits.length);

        // 3. Filter for AM habits specifically within this component
        const amHabits = allHabits.filter(h => h.timing === HabitTiming.AM);
        // Sort habits based on their sort_order, handling nulls
        amHabits.sort((a, b) => (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity));

        setAvailableHabits(amHabits); // Update state with filtered & sorted habits
        console.log('AmHabitsStep: Filtered and set AM habits:', amHabits.map(h=>h.id));

      } catch (err: unknown) {
        // Catch errors from client init, auth, or habit fetching
        console.error("AmHabitsStep: Error fetching AM habits:", err);
        setError(err instanceof Error ? err.message : "Failed to load morning habits.");
        setAvailableHabits([]); // Clear habits on error
      } finally {
        // Ensure loading state is turned off
        setLoading(false);
        console.log("AmHabitsStep: Fetch habits process finished.");
      }
    };
    // Execute the fetch function
    fetchAmHabits();
  }, []); // Empty dependency array ensures this runs only once on mount

  // Effect hook to synchronize local 'done' state if the initialValue prop changes
  useEffect(() => {
    console.log("AmHabitsStep: initialValue prop changed, updating local done set:", initialValue);
    setDoneHabitIds(new Set(initialValue));
  }, [initialValue]);

  // --- Button Handlers ---

  /**
   * Handles clicking the "Done" (CheckCircleIcon) button for a habit.
   * Adds the habit ID to the local 'done' set.
   * If the habit was previously marked as deferred (in the Zustand store), it removes it from the store's deferred list.
   */
  const handleMarkDone = useCallback((habitId: string) => {
    console.log(`AmHabitsStep: Marking habit ${habitId} as Done locally.`);
    // Update local "Done" state FIRST
    setDoneHabitIds(prevIds => {
      const newIds = new Set(prevIds);
      newIds.add(habitId);
      return newIds;
    });

    // Check if this habit ID exists in the deferred set derived from the store
    if (deferredHabitIds.has(habitId)) {
      console.log(`AmHabitsStep: Unmarking deferred habit ${habitId} in store because it was marked Done.`);
      // Call store action to remove from the 'deferred_from_startup' list
      unmarkHabitDeferred(habitId, 'startup');
    }
  }, [deferredHabitIds, unmarkHabitDeferred]); // Dependencies for useCallback

  /**
   * Handles clicking the "Do Later" (ClockIcon) button for a habit.
   * Removes the habit ID from the local 'done' set (if it was there).
   * Adds the habit ID to the store's 'deferred_from_startup' list.
   */
  const handleMarkDeferredClick = useCallback((habitId: string) => {
    console.log(`AmHabitsStep: Marking habit ${habitId} as Deferred.`);
    // Update local "Done" state FIRST (remove if it was marked done)
    setDoneHabitIds(prevIds => {
      const newIds = new Set(prevIds);
      newIds.delete(habitId);
      return newIds;
    });

    // Call the store action to add to the 'deferred_from_startup' list
    markHabitDeferred(habitId, 'startup');
  }, [markHabitDeferred]); // Dependency for useCallback

  /**
   * Handles clicking the final "Complete Startup" button.
   * Gathers the IDs from the local 'done' set and passes them to the parent via onNext.
   */
  const handleCompleteClick = useCallback(() => {
    // Convert the local Set of done IDs to an array
    const completedHabitsArray = Array.from(doneHabitIds);
    console.log("AmHabitsStep: Completing step, passing done habits to parent:", completedHabitsArray);
    // Call the parent's onNext callback with the relevant part of the form data
    onNext({ completed_am_habits: completedHabitsArray });
  }, [doneHabitIds, onNext]); // Dependencies for useCallback

  // --- Render Logic ---
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Completed AM Habits</h2>
      <p className="text-sm text-gray-600">
        Mark your morning habits as &apos;Done&apos; or choose to &apos;Do Later&apos;. Habits marked &apos;Do Later&apos; can be reviewed and confirmed during your Evening Shutdown routine.
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
          <p className="text-gray-500 text-center py-4 italic text-sm">No morning habits found. You can add habits in the &apos;Manage Habits&apos; section.</p>
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
                {/* Habit Name - Style differently if deferred and not done */}
                <span className={`text-sm font-medium ${displayDeferred ? 'text-gray-400 italic line-through' : 'text-gray-900'}`}>
                  {habit.name}
                </span>

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
        {/* Complete Startup Button */}
        <button
          type="button"
          onClick={handleCompleteClick}
          // Disable button if still loading habits or if there was an error fetching
          disabled={loading || !!error}
          className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          Complete Startup
        </button>
      </div>
    </div>
  );
}