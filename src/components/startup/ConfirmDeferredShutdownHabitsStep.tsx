'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
// Assuming types are correctly defined
import { Habit } from '@/types';
// Import the function to get the Supabase client
import { getSupabaseClient } from '@/lib/supabase/supabaseClient';
// Assuming this service function exists
import { getHabitsForUser } from '@/lib/supabase/habits'; // Service to get habit details by user ID
// Import Zustand store hook
import { useDailyLogStore } from '@/stores/dailyLogStore'; // Zustand store
// Import common components
import { LoadingOverlay } from '@/components/common/LoadingOverlay'; // Assuming this exists

// Define the props expected by this component (navigation callbacks)
interface ConfirmDeferredShutdownHabitsStepProps {
  onNext: () => void; // Callback to proceed to the next step in the parent Startup sequence
  onBack: () => void; // Callback to go back to the previous step
}

export default function ConfirmDeferredShutdownHabitsStep({ onNext, onBack }: ConfirmDeferredShutdownHabitsStepProps) {
  // --- State ---
  const [loadingHabits, setLoadingHabits] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [habitsInThisStep, setHabitsInThisStep] = useState<Habit[]>([]);
  const [confirmations, setConfirmations] = useState<Record<string, boolean | null>>({});

  // --- Zustand Store Access ---
  const initialDeferredIds = useDailyLogStore((state) => state.yesterdayLog?.deferred_from_shutdown ?? []);
  const confirmDeferredHabitAction = useDailyLogStore((state) => state.confirmDeferredHabit);

  // --- Data Fetching & Initializing Local Habit List ---
  useEffect(() => {
    const fetchAndSetHabits = async () => {
      console.log("ConfirmDeferredShutdownHabitsStep: useEffect triggered. Initial Deferred IDs:", initialDeferredIds);

      if (initialDeferredIds.length === 0) {
        setLoadingHabits(false);
        console.log("ConfirmDeferredShutdownHabitsStep: No habits deferred from yesterday's shutdown. Advancing automatically.");
        onNext();
        return;
      }

      setLoadingHabits(true);
      setFetchError(null);
      setHabitsInThisStep([]);
      setConfirmations({});

      try {
        const supabase = getSupabaseClient();
        if (!supabase) {
            console.error('ConfirmDeferredShutdownHabitsStep: Supabase client is null.');
            throw new Error('Database connection failed. Please check setup.');
        }
        console.log('ConfirmDeferredShutdownHabitsStep: Supabase client validated.');

        console.log('ConfirmDeferredShutdownHabitsStep: Fetching user from Supabase...');
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError) {
             console.error('ConfirmDeferredShutdownHabitsStep: Auth error fetching user:', authError);
             throw new Error(`Authentication error: ${authError.message}`);
        }
        if (!user) {
            console.error('ConfirmDeferredShutdownHabitsStep: User not found.');
            throw new Error('User not found');
        }
        console.log('ConfirmDeferredShutdownHabitsStep: Fetched user:', user.id);

        console.log('ConfirmDeferredShutdownHabitsStep: Fetching all habits for user:', user.id);
        const allUserHabits = await getHabitsForUser(user.id);
        console.log('ConfirmDeferredShutdownHabitsStep: Fetched total habits:', allUserHabits.length);

        const deferredSet = new Set(initialDeferredIds);
        const initialHabitsToConfirm = allUserHabits.filter(habit => deferredSet.has(habit.id));
        console.log('ConfirmDeferredShutdownHabitsStep: Filtered habits requiring confirmation:', initialHabitsToConfirm.map(h => h.id));

        setHabitsInThisStep(initialHabitsToConfirm);

        const initialConfirmations: Record<string, boolean | null> = {};
        initialHabitsToConfirm.forEach(habit => {
          initialConfirmations[habit.id] = null;
        });
        setConfirmations(initialConfirmations);
        console.log('ConfirmDeferredShutdownHabitsStep: Initialized confirmation state.');

      } catch (err) {
        console.error("ConfirmDeferredShutdownHabitsStep: Error fetching data:", err);
        setFetchError(err instanceof Error ? err.message : "Failed to load habit details.");
        setHabitsInThisStep([]);
        setConfirmations({});
      } finally {
        setLoadingHabits(false);
        console.log("ConfirmDeferredShutdownHabitsStep: Fetch process finished.");
      }
    };

    fetchAndSetHabits();
  }, [onNext, initialDeferredIds]); // Keep onNext here as it's used directly in the effect

  // --- Event Handlers ---
  const handleConfirmation = useCallback((habitId: string, didComplete: boolean) => {
    console.log(`ConfirmDeferredShutdownHabitsStep: Handling confirmation for habit ${habitId}, completed: ${didComplete}`);
    const updatedConfirmations = { ...confirmations, [habitId]: didComplete };
    setConfirmations(updatedConfirmations);
    confirmDeferredHabitAction(habitId, 'shutdown', didComplete);

    // --- FIX: Removed unused variable 'allNowConfirmed' and the commented-out auto-advance logic ---

  // Dependencies for useCallback
  // --- FIX: Removed 'onNext' as it's not used inside this callback's active code ---
  }, [confirmations, confirmDeferredHabitAction]);

  // Memoized value to check if all habits *currently displayed* have a confirmation status
  const allConfirmed = useMemo(() => {
    if (habitsInThisStep.length === 0) return true;
    const allSet = habitsInThisStep.every(habit => confirmations[habit.id] !== null && confirmations[habit.id] !== undefined);
    console.log("ConfirmDeferredShutdownHabitsStep: All confirmed status:", allSet);
    return allSet;
  }, [habitsInThisStep, confirmations]);

  // Handler for the main 'Next' button click
  const handleNextClick = useCallback(() => {
    if (!allConfirmed) {
      alert('Please confirm status (Yes/No) for all listed habits before proceeding.');
      return;
    }
    console.log('ConfirmDeferredShutdownHabitsStep: Next button clicked, calling onNext.');
    onNext();
  }, [allConfirmed, onNext]); // onNext IS used here, so it's a correct dependency

  // --- Render Logic ---
  if (loadingHabits) {
    return (
        <div className="min-h-[200px] flex items-center justify-center">
            <LoadingOverlay />
            <span className="ml-2 text-gray-500">Loading deferred habits...</span>
        </div>
    );
  }

  if (fetchError) {
    return <div className="text-center p-4 text-red-600 bg-red-50 rounded-md">Error loading habit details: {fetchError}</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Confirm Deferred Habits</h2>
      <p className="text-sm text-gray-600">
        Please confirm if you completed the following habits that were deferred from yesterday&apos;s Evening Shutdown routine.
      </p>

      <div className="space-y-3 border border-gray-200 rounded-md p-4 bg-white shadow-sm">
        {habitsInThisStep.map((habit) => {
          const confirmationStatus = confirmations[habit.id];
          return (
            <div key={habit.id} className="p-3 bg-gray-50 rounded-md flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0 shadow-sm">
              <span className="text-sm font-medium text-gray-800 flex-grow pr-4">{habit.name}</span>
              <div className="flex items-center space-x-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleConfirmation(habit.id, true)}
                  className={`px-3 py-1 text-sm rounded-md border transition-colors duration-150 ease-in-out ${
                      confirmationStatus === true
                      ? 'bg-green-600 text-white border-green-600 ring-2 ring-green-300 ring-offset-1'
                      : 'bg-white text-green-700 border-gray-300 hover:bg-green-50'
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmation(habit.id, false)}
                  className={`px-3 py-1 text-sm rounded-md border transition-colors duration-150 ease-in-out ${
                      confirmationStatus === false
                      ? 'bg-red-600 text-white border-red-600 ring-2 ring-red-300 ring-offset-1'
                      : 'bg-white text-red-700 border-gray-300 hover:bg-red-50'
                  }`}
                >
                  No
                </button>
              </div>
            </div>
          );
        })}
        {habitsInThisStep.length === 0 && !loadingHabits && !fetchError && (
          <p className="text-gray-500 text-center py-4 italic text-sm">No habits were deferred from yesterday&apos;s shutdown routine.</p>
        )}
      </div>

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
          onClick={handleNextClick}
          disabled={!allConfirmed}
          className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          Next
        </button>
      </div>
    </div>
  );
}