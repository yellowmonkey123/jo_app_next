'use client';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
// Assuming these types are correctly defined in '@/types'
import { StartupFormData, StartupStep } from '@/types';
import { useDailyLogStore } from '@/stores/dailyLogStore';
import { useInitializeSequence } from '@/lib/hooks/useInitializeSequence';
import { getLocalDateString, stripUndefined } from '@/lib/utils/dateUtils';
import { getSupabaseClient } from '@/lib/supabase/supabaseClient';
// Import Step Components
import PrevEveningRatingStep from '@/components/startup/PrevEveningRatingStep';
import SleepRatingStep from '@/components/startup/SleepRatingStep';
import MorningRatingStep from '@/components/startup/MorningRatingStep';
import FeelingStep from '@/components/startup/FeelingStep';
import AmHabitsStep from '@/components/startup/AmHabitsStep';
import ConfirmDeferredShutdownHabitsStep from '@/components/startup/ConfirmDeferredShutdownHabitsStep';
// Import Common Components
import { LoadingOverlay } from '@/components/common/LoadingOverlay';
import ErrorBanner from '@/components/common/ErrorBanner'; // Assuming ErrorBanner accepts 'message' prop

// Define the sequence of steps using the existing StartupStep enum where possible
enum StartupSequence {
  CONFIRM_DEFERRED = 'confirm-deferred', // Custom step identifier
  PREV_EVENING_RATING = StartupStep.PREV_EVENING_RATING,
  SLEEP_RATING = StartupStep.SLEEP_RATING,
  MORNING_RATING = StartupStep.MORNING_RATING,
  FEELING = StartupStep.FEELING,
  AM_HABITS = StartupStep.AM_HABITS,
}

// Initial state for the startup form data
const initialFormData: StartupFormData = {
  prev_evening_rating: null,
  sleep_rating: null,
  morning_rating: null,
  feeling_morning: '',
  completed_am_habits: [],
};

export default function StartupPage() {
  const router = useRouter();
  // Custom hook to get user ID, timezone, and initialization status/errors
  const { userId, timezone, isInitializing, initError } = useInitializeSequence();
  // Zustand store hook to get yesterday's log data and store status
  // Note: Using yesterdayLog here for deferred shutdown habits check
  const { yesterdayLog, loading: storeLoading, error: storeError } = useDailyLogStore();

  // Initialize Supabase client once in the component body
  // Note: If getSupabaseClient returns null here, the 'supabase' const will be null
  const supabase = getSupabaseClient();

  // Component state
  const [formData, setFormData] = useState<StartupFormData>(initialFormData);
  const [currentStep, setCurrentStep] = useState<StartupSequence | null>(null); // Current step in the sequence
  const [isSubmitting, setIsSubmitting] = useState(false); // Flag for submission process
  const [submitError, setSubmitError] = useState<string | null>(null); // Error during submission

  // Determine if the deferred habits confirmation step is needed based on yesterday's log
  const showConfirmation = useMemo(
    () => !storeLoading && (yesterdayLog?.deferred_from_shutdown?.length ?? 0) > 0,
    [storeLoading, yesterdayLog] // Depends on store loading state and yesterday's log data
  );

  // Build the order of steps based on whether confirmation is needed
  const stepOrder = useMemo(() => {
    const baseSteps = [
      StartupSequence.PREV_EVENING_RATING,
      StartupSequence.SLEEP_RATING,
      StartupSequence.MORNING_RATING,
      StartupSequence.FEELING,
      StartupSequence.AM_HABITS,
    ];
    // Prepend the confirmation step if required
    return showConfirmation
      ? [StartupSequence.CONFIRM_DEFERRED, ...baseSteps]
      : baseSteps;
  }, [showConfirmation]); // Depends only on whether confirmation is shown

  // Set the initial step once initialization is complete
  useEffect(() => {
     // Only set the first step if not initializing and currentStep hasn't been set yet
    if (!isInitializing && currentStep === null) {
      const firstStep = stepOrder[0]; // Get the first step from the calculated order
      setCurrentStep(firstStep);
      console.log('StartupPage: Initial step set to', firstStep);
    }
  }, [isInitializing, stepOrder, currentStep]); // Rerun when initialization status or step order changes

  // --- Submission Logic ---
  const submit = useCallback(
    async (finalFormData: StartupFormData) => {
      // Guard clause: Ensure user ID is available
      if (!userId) {
        console.error('StartupPage: User ID not available during submit.');
        setSubmitError('User not identified. Cannot save data.');
        return;
      }
      // Guard clause: Ensure timezone is available
      if (!timezone) {
        console.error('StartupPage: Timezone not available during submit.');
        setSubmitError('Timezone not identified. Cannot determine log date.');
        return;
      }

      setIsSubmitting(true); // Set loading state for UI
      setSubmitError(null); // Clear previous errors

      try {
        console.log('StartupPage: Attempting submission with timezone:', timezone);

        // Determine the correct date string based on user's timezone
        const logDate = getLocalDateString(timezone);
         if (!logDate) {
             console.error('StartupPage: Could not determine local date string from timezone', timezone);
             setSubmitError('Could not determine the correct date. Please check timezone settings.');
             setIsSubmitting(false);
             return;
        }
        console.log('StartupPage: Calculated logDate for upsert:', logDate);

        // Prepare the payload for upserting into the database
        // Use stripUndefined if necessary to remove keys with undefined values
        const payload = stripUndefined({
          user_id: userId,
          log_date: logDate,
          // Include all fields from the form data
          prev_evening_rating: finalFormData.prev_evening_rating,
          sleep_rating: finalFormData.sleep_rating,
          morning_rating: finalFormData.morning_rating,
          feeling_morning: finalFormData.feeling_morning,
          completed_am_habits: finalFormData.completed_am_habits,
          // Mark startup as completed with the current timestamp
          startup_completed_at: new Date().toISOString(),
          // Include deferred habits if they exist in yesterdayLog (merge, don't overwrite)
          // Note: This assumes deferred habits are handled elsewhere or not updated here.
          // If deferred habits need updating based on confirmation step, adjust payload accordingly.
        });

        console.log('StartupPage: Submitting upsert payload:', payload);

        // --- Start Fix: Check if Supabase client initialized successfully ---
        // Check the 'supabase' constant captured from the component's outer scope
        if (!supabase) {
          console.error('StartupPage: Supabase client is null. Check environment variables (URL, anon key).');
          // Set user-facing error message
          setSubmitError('Database connection failed. Please check your setup or try again later.');
          setIsSubmitting(false); // Reset loading state
          return; // Stop execution
        }
        // --- End Fix ---

        console.log('StartupPage: Supabase client validated for submission.');

        // Perform the upsert operation
        // Upsert combines insert and update: inserts if no matching row, updates if match found.
        // onConflict specifies the constraint to check for conflicts (unique combination of user_id and log_date)
        const { error } = await supabase
          .from('daily_logs') // Target the 'daily_logs' table
          .upsert(payload, { onConflict: 'user_id, log_date' }); // Specify conflict target

        // Handle potential errors from the upsert operation
        if (error) {
          console.error('StartupPage: Supabase upsert error:', error);
          throw error; // Throw error to be caught by the catch block
        }

        console.log('StartupPage: Upsert successful for', logDate);
        // Redirect to dashboard on successful submission, indicating completion
        router.push('/dashboard?startup=complete');

      } catch (e: unknown) {
        // Catch errors from client initialization check, payload creation, or upsert
        console.error('StartupPage: Error during submit process:', e);
        // Set user-facing error message
        setSubmitError(e instanceof Error ? e.message : 'An unexpected error occurred during submission.');
      } finally {
        // Ensure loading state is reset regardless of success or failure
        setIsSubmitting(false);
      }
    },
    // Dependencies for useCallback: re-memoize if any of these change
    // Include 'supabase' here as it's used from the outer scope
    [userId, timezone, router, supabase, setSubmitError, setIsSubmitting]
  );

  // --- Navigation Logic ---

  // Handler for moving to the next step or submitting the form
  const handleNext = useCallback(
    (stepData?: Partial<StartupFormData>) => {
       // Update form data with data from the current step
      const updatedFormData = { ...formData, ...(stepData || {}) };
      setFormData(updatedFormData);

      if (!currentStep) return; // Should not happen if initialized correctly

      const currentIndex = stepOrder.indexOf(currentStep);
      const nextIndex = currentIndex + 1;

      // Check if there is a next step in the sequence
      if (nextIndex < stepOrder.length) {
        setCurrentStep(stepOrder[nextIndex]); // Move to the next step
        console.log('StartupPage: Moving to next step:', stepOrder[nextIndex]);
      } else {
        // If this was the last step, call the submit function
        console.log('StartupPage: Reached end of steps, submitting form...');
        submit(updatedFormData); // Pass the final, updated form data
      }
    },
    [currentStep, stepOrder, formData, submit], // Dependencies
  );

  // Handler for moving back to the previous step or dashboard
  const handleBack = useCallback(() => {
    if (!currentStep) return; // Should not happen

    const currentIndex = stepOrder.indexOf(currentStep);

    // Check if there is a previous step
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]); // Move to previous step
      console.log('StartupPage: Moving back to step:', stepOrder[currentIndex - 1]);
    } else {
      // If already on the first step, navigate back to the dashboard
      console.log('StartupPage: On first step, navigating back to dashboard.');
      router.push('/dashboard');
    }
  }, [currentStep, stepOrder, router]); // Dependencies

  // --- Render Logic ---

  // Handle initialization or store errors first
  if (initError) return <ErrorBanner message={`Initialization Error: ${initError}`} />;
  if (storeError) return <ErrorBanner message={`Store Error: ${storeError}`} />;
  // Show loading overlay if initializing, store is loading, or current step isn't set yet
  // Using LoadingOverlay without message prop as per previous fix
  if (isInitializing || storeLoading || !currentStep) return <LoadingOverlay />;

  // Main component render
  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header with title and cancel link */}
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Morning Startup</h1>
        {/* Hide cancel link during submission */}
        {!isSubmitting && (
          <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline">
            Cancel
          </Link>
        )}
      </header>

      {/* Display submission errors */}
      {/* Assuming ErrorBanner expects only 'message' prop based on previous discussion */}
      {submitError && <ErrorBanner message={submitError} />}

      {/* Container for the current step component */}
      <div className="relative bg-white shadow-md rounded-lg p-6 min-h-[350px] flex flex-col">
        {/* Render the component corresponding to the current step */}
        {currentStep === StartupSequence.CONFIRM_DEFERRED && (
          <ConfirmDeferredShutdownHabitsStep onNext={handleNext} onBack={handleBack} />
        )}
        {currentStep === StartupSequence.PREV_EVENING_RATING && (
          <PrevEveningRatingStep
            initialValue={formData.prev_evening_rating}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}
        {currentStep === StartupSequence.SLEEP_RATING && (
          <SleepRatingStep
            initialValue={formData.sleep_rating}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}
        {currentStep === StartupSequence.MORNING_RATING && (
          <MorningRatingStep
            initialValue={formData.morning_rating}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}
        {currentStep === StartupSequence.FEELING && (
          <FeelingStep
            initialValue={formData.feeling_morning}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}
        {currentStep === StartupSequence.AM_HABITS && (
          // Pass necessary props to AmHabitsStep, e.g., habits list if needed
          <AmHabitsStep
            initialValue={formData.completed_am_habits}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}

        {/* Show loading overlay specifically during submission */}
        {/* Using LoadingOverlay without message prop */}
        {isSubmitting && <LoadingOverlay overlay />}
      </div>
    </div>
  );
}