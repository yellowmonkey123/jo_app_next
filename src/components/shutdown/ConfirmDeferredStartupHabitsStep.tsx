'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
// Import Supabase client function
import { getSupabaseClient } from '@/lib/supabase/supabaseClient'; // Updated import for client-side
// Assuming Habit type is correctly defined
import { Habit } from '@/types';
// Assuming this service function exists and works correctly
import { getHabitsForUser } from '@/lib/supabase/habits'; // Service to get habit details by user ID
// Import Zustand store hook
import { useDailyLogStore } from '@/stores/dailyLogStore'; // Zustand store
// Import common components
import { LoadingOverlay } from '@/components/common/LoadingOverlay'; // Assuming this exists and works without 'message' prop

// Define the props expected by this component (navigation callbacks)
interface ConfirmDeferredStartupHabitsStepProps {
  onNext: () => void; // Callback to proceed to the next step in the parent Shutdown sequence
  onBack: () => void; // Callback to go back to the previous step or dashboard
}

export default function ConfirmDeferredStartupHabitsStep({ onNext, onBack }: ConfirmDeferredStartupHabitsStepProps) {
  // --- State ---
  // Loading state specifically for fetching habit details for this step
  const [loadingHabits, setLoadingHabits] = useState(true);
  // Error state for fetching habit details
  const [fetchError, setFetchError] = useState<string | null>(null);
  // Local state to hold the *details* of habits needing confirmation in this step
  const [habitsInThisStep, setHabitsInThisStep] = useState<Habit[]>([]);
  // Local state to track the user's confirmation (Yes/No) for each habit ID
  const [confirmations, setConfirmations] = useState<Record<string, boolean | null>>({}); // { [habitId]: true/false/null }

  // --- Zustand Store Access ---
  // Get the list of deferred habit IDs from today's log ONCE on initial render.
  // This prevents issues if the store updates while the user is on this step.
  const initialDeferredIds = useDailyLogStore((state) => state.todayLog?.deferred_from_startup ?? []);
  // Get the action from the store to update the confirmation status
  const confirmDeferredHabitAction = useDailyLogStore((state) => state.confirmDeferredHabit);

  // --- Data Fetching & Initialization ---
  // Effect hook to fetch habit details based on the initialDeferredIds
  useEffect(() => {
    // Define the async function to perform fetching
    const fetchAndSetHabits = async () => {
      console.log("ConfirmDeferredStartupHabitsStep: useEffect triggered. Initial Deferred IDs:", initialDeferredIds);

      // If there were no deferred habits initially, skip fetching and advance
      if (initialDeferredIds.length === 0) {
        setLoadingHabits(false);
        console.log("ConfirmDeferredStartupHabitsStep: No habits deferred from today's startup. Advancing automatically.");
        onNext(); // Advance immediately
        return;
      }

      // Reset state for fetching
      setLoadingHabits(true);
      setFetchError(null);
      setHabitsInThisStep([]); // Clear previous habits for this step
      setConfirmations({}); // Clear previous confirmations

      try {
        // Get Supabase client instance
        const supabase = getSupabaseClient(); // Use the client-side Supabase client

        // --- Start Fix: Check if Supabase client initialized successfully ---
        if (!supabase) {
            console.error('ConfirmDeferredStartupHabitsStep: Supabase client is null. Check environment configuration.');
            // Throw an error to be handled by the catch block below
            throw new Error('Database connection failed. Please check setup or try again later.');
        }
        // --- End Fix ---
        console.log('ConfirmDeferredStartupHabitsStep: Supabase client validated.');

        // 1. Get current user (needed to fetch user-specific habits)
        console.log('ConfirmDeferredStartupHabitsStep: Fetching user from Supabase...');
        // supabase is guaranteed non-null here
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        // Handle auth error or no user found
        if (authError || !user) {
          console.error('ConfirmDeferredStartupHabitsStep: Auth error or user not found:', authError);
          throw new Error("User authentication failed or user not found.");
        }
        console.log('ConfirmDeferredStartupHabitsStep: Fetched user:', user.id);

        // 2. Fetch all habits for the user
        // Assuming getHabitsForUser handles its own client or receives one and checks it
        console.log('ConfirmDeferredStartupHabitsStep: Fetching all habits for user:', user.id);
        const allUserHabits = await getHabitsForUser(user.id);
        console.log('ConfirmDeferredStartupHabitsStep: Fetched total habits:', allUserHabits.length);

        // 3. Filter the fetched habits to find those matching the initialDeferredIds
        const deferredSet = new Set(initialDeferredIds); // Create a Set for efficient lookup
        const initialHabitsToConfirm = allUserHabits.filter(habit => deferredSet.has(habit.id));
        console.log('ConfirmDeferredStartupHabitsStep: Filtered habits requiring confirmation:', initialHabitsToConfirm.map(h => h.id));

        // 4. Update local state with the habits to be displayed in this step
        setHabitsInThisStep(initialHabitsToConfirm);

        // 5. Initialize the confirmation state (all set to null initially)
        const initialConfirmations: Record<string, boolean | null> = {};
        initialHabitsToConfirm.forEach(habit => {
          initialConfirmations[habit.id] = null; // null means not yet confirmed
        });
        setConfirmations(initialConfirmations);
        console.log('ConfirmDeferredStartupHabitsStep: Initialized confirmation state.');

      } catch (err) {
        // Catch errors from client init, auth, or habit fetching
        console.error("ConfirmDeferredStartupHabitsStep: Error fetching data:", err);
        setFetchError(err instanceof Error ? err.message : "Failed to load habit details.");
        setHabitsInThisStep([]); // Clear habits on error
        setConfirmations({}); // Clear confirmations on error
      } finally {
        // Ensure loading state is turned off
        setLoadingHabits(false);
        console.log("ConfirmDeferredStartupHabitsStep: Fetch process finished.");
      }
    };

    // Execute the fetch function
    fetchAndSetHabits();

    // Dependencies for the useEffect hook.
    // Only re-run if these callbacks change reference or if the initial IDs list changes.
    // Using initialDeferredIds ensures it only runs based on the IDs present when the step mounted.
  }, [onNext, initialDeferredIds]); // Removed onBack as it's not used in the effect

  // --- Event Handlers ---

  // Handles clicking 'Yes' or 'No' for a specific habit
  const handleConfirmation = useCallback((habitId: string, didComplete: boolean) => {
    console.log(`ConfirmDeferredStartupHabitsStep: Handling confirmation for habit ${habitId}, completed: ${didComplete}`);
    // Update local confirmation state
    const updatedConfirmations = { ...confirmations, [habitId]: didComplete };
    setConfirmations(updatedConfirmations);

    // Update the Zustand store (this likely updates the main daily log)
    // Pass 'startup' to indicate these are deferred habits from the startup routine
    confirmDeferredHabitAction(habitId, 'startup', didComplete);

    // --- Check if all habits in *this step* are now confirmed ---
    // This check was previously inside useEffect, moved here for immediate feedback logic if needed
    // Note: The original logic automatically called onNext() when all were confirmed.
    // Keeping it separate with an explicit Next button might be clearer UX.
    // const allNowConfirmed = habitsInThisStep.every(
    //   habit => updatedConfirmations[habit.id] !== null && updatedConfirmations[habit.id] !== undefined
    // );
    // if (allNowConfirmed && habitsInThisStep.length > 0) {
    //   console.log("ConfirmDeferredStartupHabitsStep: All habits confirmed, calling onNext.");
    //   onNext(); // Removed automatic advancement - rely on Next button
    // }

  // Dependencies for useCallback
  }, [confirmations, confirmDeferredHabitAction]); // Removed habitsInThisStep, onNext if not auto-advancing

  // Memoized value to check if all habits *currently displayed* have a confirmation status
  const allConfirmed = useMemo(() => {
    // If there are no habits to confirm, consider it confirmed
    if (habitsInThisStep.length === 0) return true;
    // Check if every habit in the local list has a non-null confirmation status
    const allSet = habitsInThisStep.every(habit => confirmations[habit.id] !== null && confirmations[habit.id] !== undefined);
    console.log("ConfirmDeferredStartupHabitsStep: All confirmed status:", allSet);
    return allSet;
  }, [habitsInThisStep, confirmations]); // Recompute when the list or confirmations change

  // Handler for the main 'Next' button click
  const handleNextClick = useCallback(() => {
    // Prevent proceeding if not all habits shown have been confirmed
    if (!allConfirmed) {
      // Provide feedback to the user
      alert("Please confirm status (Yes/No) for all listed habits before proceeding.");
      return;
    }
    console.log("ConfirmDeferredStartupHabitsStep: Next button clicked, all confirmed. Calling onNext.");
    // Call the parent component's onNext callback
    onNext();
  }, [allConfirmed, onNext]); // Dependencies

  // --- Render Logic ---

  // Display loading overlay while fetching habit details
  if (loadingHabits) {
    return (
        <div className="min-h-[200px] flex items-center justify-center">
            {/* Assuming LoadingOverlay exists and works without message */}
            <LoadingOverlay />
            <span className="ml-2 text-gray-500">Loading deferred habits...</span>
        </div>
    );
  }

  // Display error message if fetching failed
  if (fetchError) {
    return <div className="text-center p-4 text-red-600 bg-red-50 rounded-md">Error loading habit details: {fetchError}</div>;
  }

  // Main render logic for the confirmation step
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Confirm Deferred Habits</h2>
      <p className="text-sm text-gray-600">
        Please confirm if you completed the following habits that were deferred from your Startup routine earlier today.
      </p>

      {/* Container for the list of habits */}
      <div className="space-y-3 border border-gray-200 rounded-md p-4 bg-white">
        {/* Map over the locally stored habits for this step */}
        {habitsInThisStep.map((habit) => {
          // Get the current confirmation status for this habit
          const confirmationStatus = confirmations[habit.id];
          return (
            <div key={habit.id} className="p-3 bg-gray-50 rounded-md flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0 shadow-sm">
              {/* Habit Name */}
              <span className="text-sm font-medium text-gray-800 flex-grow pr-4">{habit.name}</span>
              {/* Yes/No Confirmation Buttons */}
              <div className="flex items-center space-x-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleConfirmation(habit.id, true)} // Confirm as completed
                  // Apply dynamic styling based on confirmation status
                  className={`px-3 py-1 text-sm rounded-md border transition-colors duration-150 ease-in-out ${
                      confirmationStatus === true
                      ? 'bg-green-600 text-white border-green-600 ring-2 ring-green-300 ring-offset-1' // Selected 'Yes' style
                      : 'bg-white text-green-700 border-green-300 hover:bg-green-50' // Default 'Yes' style
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmation(habit.id, false)} // Confirm as not completed
                   // Apply dynamic styling based on confirmation status
                  className={`px-3 py-1 text-sm rounded-md border transition-colors duration-150 ease-in-out ${
                      confirmationStatus === false
                      ? 'bg-red-600 text-white border-red-600 ring-2 ring-red-300 ring-offset-1' // Selected 'No' style
                      : 'bg-white text-red-700 border-red-300 hover:bg-red-50' // Default 'No' style
                  }`}
                >
                  No
                </button>
              </div>
            </div>
          );
        })}
        {/* Show message only if loading finished and list is truly empty */}
        {habitsInThisStep.length === 0 && !loadingHabits && !fetchError && (
          <p className="text-gray-500 text-center py-4 italic">No habits were deferred from today&apos;s startup routine.</p>
        )}
      </div>

      {/* Navigation Buttons (Back/Next) */}
      <div className="flex justify-between pt-6">
        {/* Back Button */}
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Back
        </button>
        {/* Next Button - disabled until all habits are confirmed */}
        <button
          type="button"
          onClick={handleNextClick}
          disabled={!allConfirmed} // Disable based on memoized state
          className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          Next
        </button>
      </div>
    </div>
  );
}