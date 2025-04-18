// src/components/startup/AmHabitsStep.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Habit, HabitTiming, StartupFormData } from '@/types';
import { getHabitsForUser } from '@/lib/supabase/habits';
import { useDailyLogStore } from '@/stores/dailyLogStore'; // Import the store
import { CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline';

interface AmHabitsStepProps {
  initialValue: string[]; // Array of initially *completed* habit IDs for this load
  onNext: (data: Partial<StartupFormData>) => void;
  onBack: () => void;
}

export default function AmHabitsStep({ initialValue, onNext, onBack }: AmHabitsStepProps) {
  const [availableHabits, setAvailableHabits] = useState<Habit[]>([]);
  // Local state for habits marked "Done" in this session
  const [doneHabitIds, setDoneHabitIds] = useState<Set<string>>(new Set(initialValue));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Zustand Store Access ---
  // Get actions from the store
  const markHabitDeferred = useDailyLogStore((state) => state.markHabitDeferred);
  const unmarkHabitDeferred = useDailyLogStore((state) => state.unmarkHabitDeferred); // Get the new action

  // Select the raw array of deferred IDs from the store
  const deferredStartupArray = useDailyLogStore((state) => state.todayLog?.deferred_from_startup);
  // Create a Set from the array using useMemo for stable reference
  const deferredHabitIds = useMemo(() => new Set(deferredStartupArray ?? []), [deferredStartupArray]);


  // Fetch relevant AM habits on component mount
  useEffect(() => {
    const fetchAmHabits = async () => {
      setLoading(true);
      setError(null);
      try {
        // Ensure user is available before fetching
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not found");

        // Use the service function to get all habits
        const data = await getHabitsForUser(user.id);

        // Filter for AM habits specifically within this component
        const amHabits = data.filter(h => h.timing === HabitTiming.AM);
        setAvailableHabits(amHabits);

      } catch (err: unknown) {
        console.error("Error fetching AM habits:", err);
        setError(err instanceof Error ? err.message : "Failed to load morning habits.");
        setAvailableHabits([]); // Clear habits on error
      } finally {
        setLoading(false);
      }
    };
    fetchAmHabits();
  }, []); // Empty dependency array ensures this runs only once on mount

  // Update local "done" state if the initialValue prop changes from parent
  useEffect(() => {
    setDoneHabitIds(new Set(initialValue));
  }, [initialValue]);

  // --- Button Handlers ---

  /**
   * Handles clicking the "Done" button for a habit.
   * Adds the habit to the local 'done' set and removes it from the store's 'deferred' list if present.
   */
  const handleMarkDone = (habitId: string) => {
    // Update local "Done" state FIRST
    setDoneHabitIds(prevIds => {
        const newIds = new Set(prevIds);
        newIds.add(habitId);
        return newIds;
    });
    // --- Call unmarkHabitDeferred ---
    // If this habit was previously deferred in the store, remove it now
    if (deferredHabitIds.has(habitId)) {
        console.log(`AmHabitsStep: Unmarking deferred habit ${habitId} because it was marked Done.`);
        unmarkHabitDeferred(habitId, 'startup'); // Call store action
    }
    // --- End Call ---
  };

  /**
   * Handles clicking the "Do Later" button for a habit.
   * Removes the habit from the local 'done' set and adds it to the store's 'deferred' list.
   */
  const handleMarkDeferredClick = (habitId: string) => {
    // Update local "Done" state FIRST (remove if it was marked done)
    setDoneHabitIds(prevIds => {
        const newIds = new Set(prevIds);
        newIds.delete(habitId);
        return newIds;
    });
    // Call the store action to add to deferred list
    console.log(`AmHabitsStep: Marking habit ${habitId} as deferred.`);
    markHabitDeferred(habitId, 'startup');
  };

  /**
   * Handles clicking the final "Complete Startup" button.
   * Passes only the locally marked "Done" habits to the parent.
   */
  const handleCompleteClick = () => {
    const completedHabitsArray = Array.from(doneHabitIds);
    console.log("AmHabitsStep: Completing step with done habits:", completedHabitsArray);
    onNext({ completed_am_habits: completedHabitsArray });
  };

  // --- Render Logic ---
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Completed AM Habits</h2>
      {/* Updated descriptive text to match desired logic */}
      <p className="text-gray-600">
        Mark your morning habits as &quot;Done&quot; or choose to &quot;Do Later&quot;. Deferred habits can be confirmed during your Evening Shutdown.
      </p>
      <div className="space-y-3 max-h-60 overflow-y-auto border border-gray-200 rounded-md p-4">
        {/* Loading State */}
        {loading && <p className="text-gray-500">Loading habits...</p>}
        {/* Error State */}
        {error && <p className="text-red-600">Error: {error}</p>}
        {/* Empty State */}
        {!loading && !error && availableHabits.length === 0 && (
          <p className="text-gray-500">No morning habits found. You can add habits in the &apos;Manage Habits&apos; section.</p>
        )}

        {/* Habit List */}
        {!loading && !error && availableHabits.length > 0 && (
          availableHabits.map((habit) => {
            // Determine current status based on local 'done' state and store's 'deferred' state
            const isDone = doneHabitIds.has(habit.id);
            const isDeferredInStore = deferredHabitIds.has(habit.id);
            // A habit is considered deferred for display *only if* it's in the deferred store list
            // AND it hasn't been marked as done locally in *this* session.
            const displayDeferred = isDeferredInStore && !isDone;
            const displayDone = isDone;

            return (
              <div key={habit.id} className="flex items-center justify-between py-1">
                {/* Habit Name - Style differently if deferred and not done */}
                <span className={`text-sm ${displayDeferred ? 'text-gray-400 italic' : 'text-gray-900'}`}>
                  {habit.name}
                </span>

                {/* Action Buttons */}
                <div className="flex items-center space-x-2">
                   {/* "Do Later" Button */}
                   <button
                      type="button"
                      onClick={() => handleMarkDeferredClick(habit.id)}
                      title="Do Later"
                      // Style based on deferred status, disable if marked done locally
                      className={`p-1 rounded-full ${displayDeferred ? 'bg-orange-100 text-orange-600' : 'text-gray-400 hover:text-orange-500 hover:bg-orange-50'} ${displayDone ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={displayDone} // Prevent deferring if marked done locally
                    >
                      <ClockIcon className="h-5 w-5" />
                   </button>

                   {/* "Done" Button */}
                   <button
                      type="button"
                      onClick={() => handleMarkDone(habit.id)}
                      title="Done"
                      // Style based only on local 'done' status
                      className={`p-1 rounded-full ${displayDone ? 'bg-green-100 text-green-600' : 'text-gray-400 hover:text-green-500 hover:bg-green-50'}`}
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
        <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
            Back
        </button>
        <button
            type="button"
            onClick={handleCompleteClick}
            disabled={loading || !!error} // Disable if loading or error fetching habits
            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${loading || !!error ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            Complete Startup
        </button>
      </div>
    </div>
  );
}
