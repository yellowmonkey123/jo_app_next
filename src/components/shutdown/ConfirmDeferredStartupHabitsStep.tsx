// src/components/shutdown/ConfirmDeferredStartupHabitsStep.tsx
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client'; // For auth check
import { Habit } from '@/types';
import { getHabitsForUser } from '@/lib/supabase/habits'; // Service to get habit details
import { useDailyLogStore } from '@/stores/dailyLogStore'; // Zustand store
import LoadingSpinner from '@/components/LoadingSpinner'; // Assuming this exists

// Define props (navigation callbacks)
interface ConfirmDeferredStartupHabitsStepProps {
  onNext: () => void; // Go to the next step in Shutdown sequence
  onBack: () => void; // Go back to the previous step in Shutdown sequence
}

export default function ConfirmDeferredStartupHabitsStep({ onNext, onBack }: ConfirmDeferredStartupHabitsStepProps) {
  // --- State ---
  const [allUserHabits, setAllUserHabits] = useState<Habit[]>([]);
  const [loadingHabits, setLoadingHabits] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [habitsInThisStep, setHabitsInThisStep] = useState<Habit[]>([]);
  const [confirmations, setConfirmations] = useState<Record<string, boolean | null>>({});

  // --- Zustand Store Access ---
  // Get deferred habit IDs from *today's* log startup list ONCE for initialization
  const initialDeferredIds = useDailyLogStore((state) => state.todayLog?.deferred_from_startup ?? []);
  const confirmDeferredHabitAction = useDailyLogStore((state) => state.confirmDeferredHabit);

  // --- Data Fetching & Initializing Local Habit List ---
  useEffect(() => {
    // Use the initialDeferredIds captured on first render
    const fetchAndSetHabits = async () => {
      if (initialDeferredIds.length === 0) {
          setLoadingHabits(false);
          console.log("ConfirmDeferredStartupHabitsStep: No habits deferred from today's startup, calling onNext.");
          onNext(); // Advance immediately if nothing to confirm
          return;
      }

      setLoadingHabits(true);
      setFetchError(null);
      setHabitsInThisStep([]);
      setConfirmations({});

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not found");
        const habits = await getHabitsForUser(user.id);
        setAllUserHabits(habits); // Store all habits

        const deferredSet = new Set(initialDeferredIds); // Use the initial IDs
        const initialHabitsToConfirm = habits.filter(habit => deferredSet.has(habit.id));
        setHabitsInThisStep(initialHabitsToConfirm); // Set the local list

        const initialConfirmations: Record<string, boolean | null> = {};
        initialHabitsToConfirm.forEach(habit => {
            initialConfirmations[habit.id] = null;
        });
        setConfirmations(initialConfirmations);

      } catch (err) {
        console.error("Error fetching habits for confirmation step:", err);
        setFetchError(err instanceof Error ? err.message : "Failed to load habit details.");
      } finally {
        setLoadingHabits(false);
      }
    };

    fetchAndSetHabits();
    // --- REMOVED deferredHabitIds from dependency array ---
  }, [onNext, onBack]); // Pass stable functions if possible, or remove if guaranteed stable

  // --- Event Handlers ---
  const handleConfirmation = useCallback((habitId: string, didComplete: boolean) => {
    const updatedConfirmations = { ...confirmations, [habitId]: didComplete };
    setConfirmations(updatedConfirmations);
    confirmDeferredHabitAction(habitId, 'startup', didComplete); // Use 'startup' type

    const allNowConfirmed = habitsInThisStep.every(
        habit => updatedConfirmations[habit.id] !== null && updatedConfirmations[habit.id] !== undefined
    );

    if (allNowConfirmed && habitsInThisStep.length > 0) {
        console.log("ConfirmDeferredStartupHabitsStep: All habits confirmed, calling onNext.");
        onNext();
    }
  }, [confirmations, habitsInThisStep, confirmDeferredHabitAction, onNext]);

  // Check if all displayed habits have been confirmed
  const allConfirmed = useMemo(() => {
      if (habitsInThisStep.length === 0) return true;
      return habitsInThisStep.every(habit => confirmations[habit.id] !== undefined && confirmations[habit.id] !== null);
  }, [habitsInThisStep, confirmations]);

  const handleNextClick = useCallback(() => {
      if (!allConfirmed) {
         alert("Please confirm status (Yes/No) for all deferred habits.");
         return;
      }
      console.log("ConfirmDeferredStartupHabitsStep: Next button clicked, calling onNext.");
      onNext();
  }, [allConfirmed, onNext]);


  // --- Render Logic ---
  if (loadingHabits) {
    return <div className="min-h-[200px] flex items-center justify-center"><LoadingSpinner /></div>;
  }

  if (fetchError) {
    return <div className="text-center p-4 text-red-600">Error loading habit details: {fetchError}</div>;
  }

  // Main render logic - list deferred habits based on LOCAL state habitsInThisStep
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Confirm Deferred Habits</h2>
      <p className="text-gray-600">
        Did you complete these habits after your startup routine earlier today?
      </p>
      <div className="space-y-4 border border-gray-200 rounded-md p-4">
        {/* Render based on habitsInThisStep */}
        {habitsInThisStep.map((habit) => {
          const confirmationStatus = confirmations[habit.id];
          return (
            <div key={habit.id} className="p-3 bg-gray-50 rounded-md flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
              <span className="text-sm font-medium text-gray-800">{habit.name}</span>
              {/* Yes/No Buttons */}
              <div className="flex items-center space-x-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleConfirmation(habit.id, true)}
                  className={`px-3 py-1 text-sm rounded-md border ${confirmationStatus === true ? 'bg-green-600 text-white border-green-600' : 'bg-white text-green-700 border-green-300 hover:bg-green-50'}`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmation(habit.id, false)}
                  className={`px-3 py-1 text-sm rounded-md border ${confirmationStatus === false ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-700 border-red-300 hover:bg-red-50'}`}
                >
                  No
                </button>
              </div>
            </div>
          );
        })}
        {/* Show message only if loading finished and list is truly empty */}
         {habitsInThisStep.length === 0 && !loadingHabits && !fetchError && (
             <p className="text-gray-500 text-center py-4">No habits were deferred from today's startup.</p>
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
          onClick={handleNextClick}
          disabled={!allConfirmed}
          className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${!allConfirmed ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Next
        </button>
      </div>
    </div>
  );
}
