'use client';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
// Assuming these types are correctly defined
import { ShutdownFormData, ShutdownStep } from '@/types';
import { useDailyLogStore } from '@/stores/dailyLogStore';
import { useInitializeSequence } from '@/lib/hooks/useInitializeSequence';
import { getLocalDateString, stripUndefined } from '@/lib/utils/dateUtils';
import { getSupabaseClient } from '@/lib/supabase/supabaseClient';
// Import Step Components
import ConfirmDeferredStartupHabitsStep from '@/components/shutdown/ConfirmDeferredStartupHabitsStep';
import DayRatingStep from '@/components/shutdown/DayRatingStep';
import AccomplishmentStep from '@/components/shutdown/AccomplishmentStep';
import ImprovementStep from '@/components/shutdown/ImprovementStep';
import PmHabitsStep from '@/components/shutdown/PmHabitsStep';
// Import Common Components
import { LoadingOverlay } from '@/components/common/LoadingOverlay';
import ErrorBanner from '@/components/common/ErrorBanner';

// Define the sequence of steps using the existing ShutdownStep enum where possible
enum ShutdownSequence {
  CONFIRM_DEFERRED       = 'confirm-deferred', // Custom step identifier
  DAY_RATING             = ShutdownStep.DAY_RATING,
  ACCOMPLISHMENT         = ShutdownStep.ACCOMPLISHMENT,
  IMPROVEMENT            = ShutdownStep.IMPROVEMENT,
  PM_ANYTIME_HABITS      = ShutdownStep.PM_ANYTIME_HABITS,
}

// Initial state for the shutdown form data
const initialFormData: ShutdownFormData = {
  day_rating: null,
  accomplishment: '',
  improvement: '',
  completed_pm_anytime_habits: [],
};

export default function ShutdownPage() {
  const router = useRouter();
  // Custom hook to get user ID, timezone, and initialization status/errors
  const { userId, timezone, isInitializing, initError } = useInitializeSequence();
  // Zustand store hook to get today's log data and store status
  const { todayLog, loading: storeLoading, error: storeError } = useDailyLogStore();

  // Component state
  const [formData, setFormData]       = useState<ShutdownFormData>(initialFormData);
  const [currentStep, setCurrentStep] = useState<ShutdownSequence | null>(null); // Current step in the sequence
  const [isSubmitting, setIsSubmitting] = useState(false); // Flag for submission process
  const [submitError, setSubmitError]   = useState<string | null>(null); // Error during submission

  // Determine if the deferred habits confirmation step is needed
  const showConfirmation = useMemo(
    () => !storeLoading && (todayLog?.deferred_from_startup?.length ?? 0) > 0,
    [storeLoading, todayLog] // Depends on store loading state and today's log data
  );

  // Build the order of steps based on whether confirmation is needed
  const stepOrder = useMemo(() => {
    const baseSteps = [
      ShutdownSequence.DAY_RATING,
      ShutdownSequence.ACCOMPLISHMENT,
      ShutdownSequence.IMPROVEMENT,
      ShutdownSequence.PM_ANYTIME_HABITS,
    ];
    // Prepend the confirmation step if required
    return showConfirmation ? [ShutdownSequence.CONFIRM_DEFERRED, ...baseSteps] : baseSteps;
  }, [showConfirmation]); // Depends only on whether confirmation is shown

  // Set the initial step once initialization is complete
  useEffect(() => {
    // Only set the first step if not initializing and currentStep hasn't been set yet
    if (!isInitializing && currentStep === null) {
      const firstStep = stepOrder[0]; // Get the first step from the calculated order
      setCurrentStep(firstStep);
      console.log('ShutdownPage: Initial step set to', firstStep);
    }
  }, [isInitializing, stepOrder, currentStep]); // Rerun when initialization status or step order changes

  // --- Submission Logic ---
  const submit = useCallback(
    async (finalFormData: ShutdownFormData) => {
      // Guard clause: Ensure user ID is available
      if (!userId) {
        console.error('ShutdownPage: User ID not available during submit.');
        setSubmitError('User not identified. Cannot save data.');
        return;
      }
      // Guard clause: Ensure timezone is available
       if (!timezone) {
        console.error('ShutdownPage: Timezone not available during submit.');
        setSubmitError('Timezone not identified. Cannot determine log date.');
        return;
      }

      setIsSubmitting(true); // Set loading state for UI
      setSubmitError(null); // Clear previous errors

      try {
        // Get Supabase client instance
        const supabase = getSupabaseClient();

        // --- Start Fix: Check if Supabase client initialized successfully ---
        if (!supabase) {
          console.error('ShutdownPage: Supabase client is null. Check environment variables (URL, anon key).');
          // Set user-facing error message
          setSubmitError('Database connection failed. Please check your setup or try again later.');
          setIsSubmitting(false); // Reset loading state
          return; // Stop execution
        }
        // --- End Fix ---

        console.log('ShutdownPage: Supabase client validated for submission.');

        // Determine the correct date string based on user's timezone
        const logDate = getLocalDateString(timezone);
        if (!logDate) {
             console.error('ShutdownPage: Could not determine local date string from timezone', timezone);
             setSubmitError('Could not determine the correct date. Please check timezone settings.');
             setIsSubmitting(false);
             return;
        }

        // Prepare the payload for upserting into the database
        // Use stripUndefined to remove any keys with undefined values if necessary
        const payload = stripUndefined({
          user_id: userId,
          log_date: logDate,
          // Include all fields from the form data
          day_rating: finalFormData.day_rating,
          accomplishment: finalFormData.accomplishment,
          improvement: finalFormData.improvement,
          completed_pm_anytime_habits: finalFormData.completed_pm_anytime_habits,
          // Mark shutdown as completed with the current timestamp
          shutdown_completed_at: new Date().toISOString(),
          // Include deferred habits if they exist in todayLog (merge, don't overwrite)
          // Note: This assumes deferred habits are handled elsewhere or not updated here.
          // If deferred habits need updating based on confirmation step, adjust payload accordingly.
        });

        console.log('ShutdownPage: Submitting upsert payload:', payload);

        // Perform the upsert operation
        // Upsert combines insert and update: inserts if no matching row, updates if match found.
        // onConflict specifies the constraint to check for conflicts (unique combination of user_id and log_date)
        const { error } = await supabase
          .from('daily_logs') // Target the 'daily_logs' table
          .upsert(payload, { onConflict: 'user_id, log_date' }); // Specify conflict target

        // Handle potential errors from the upsert operation
        if (error) {
          console.error('ShutdownPage: Supabase upsert error:', error);
          throw error; // Throw error to be caught by the catch block
        }

        console.log('ShutdownPage: Upsert successful for', logDate);
        // Redirect to dashboard on successful submission, indicating completion
        router.push('/dashboard?shutdown=complete');

      } catch (e: unknown) {
        // Catch errors from client initialization, payload creation, or upsert
        console.error('ShutdownPage: Error during submit process:', e);
        // Set user-facing error message
        setSubmitError(e instanceof Error ? e.message : 'An unexpected error occurred during submission.');
      } finally {
        // Ensure loading state is reset regardless of success or failure
        setIsSubmitting(false);
      }
    },
    // Dependencies for useCallback: re-memoize if any of these change
    [userId, timezone, router, setSubmitError, setIsSubmitting]
  );

  // --- Navigation Logic ---

  // Handler for moving to the next step or submitting the form
  const handleNext = useCallback(
    (stepData?: Partial<ShutdownFormData>) => {
      // Update form data with data from the current step
      const updatedFormData = { ...formData, ...(stepData || {}) };
      setFormData(updatedFormData);

      if (!currentStep) return; // Should not happen if initialized correctly

      const currentIndex = stepOrder.indexOf(currentStep);
      const nextIndex = currentIndex + 1;

      // Check if there is a next step in the sequence
      if (nextIndex < stepOrder.length) {
        setCurrentStep(stepOrder[nextIndex]); // Move to the next step
        console.log('ShutdownPage: Moving to next step:', stepOrder[nextIndex]);
      } else {
        // If this was the last step, call the submit function
        console.log('ShutdownPage: Reached end of steps, submitting form...');
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
      console.log('ShutdownPage: Moving back to step:', stepOrder[currentIndex - 1]);
    } else {
      // If already on the first step, navigate back to the dashboard
      console.log('ShutdownPage: On first step, navigating back to dashboard.');
      router.push('/dashboard');
    }
  }, [currentStep, stepOrder, router]); // Dependencies

  // --- Render Logic ---

  // Handle initialization or store errors first
  if (initError)    return <ErrorBanner message={`Initialization Error: ${initError}`} />;
  if (storeError)   return <ErrorBanner message={`Store Error: ${storeError}`} />;
  // Show loading overlay if initializing, store is loading, or current step isn't set yet
  if (isInitializing || storeLoading || !currentStep) return <LoadingOverlay />;

  // Main component render
  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header with title and cancel link */}
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Evening Shutdown</h1>
        {/* Hide cancel link during submission */}
        {!isSubmitting && <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline">Cancel</Link>}
      </header>

      {/* Display submission errors */}
      {submitError && <ErrorBanner message={submitError} />}

      {/* Container for the current step component */}
      <div className="relative bg-white shadow-md rounded-lg p-6 min-h-[350px] flex flex-col">
        {/* Render the component corresponding to the current step */}
        {currentStep === ShutdownSequence.CONFIRM_DEFERRED && (
          <ConfirmDeferredStartupHabitsStep onNext={handleNext} onBack={handleBack} />
        )}
        {currentStep === ShutdownSequence.DAY_RATING && (
          <DayRatingStep initialValue={formData.day_rating} onNext={handleNext} onBack={handleBack} />
        )}
        {currentStep === ShutdownSequence.ACCOMPLISHMENT && (
          <AccomplishmentStep initialValue={formData.accomplishment} onNext={handleNext} onBack={handleBack} />
        )}
        {currentStep === ShutdownSequence.IMPROVEMENT && (
          <ImprovementStep initialValue={formData.improvement} onNext={handleNext} onBack={handleBack} />
        )}
        {currentStep === ShutdownSequence.PM_ANYTIME_HABITS && (
          // Pass necessary props to PmHabitsStep, e.g., habits list if needed
          <PmHabitsStep initialValue={formData.completed_pm_anytime_habits} onNext={handleNext} onBack={handleBack} />
        )}

        {/* Show loading overlay specifically during submission */}
        {isSubmitting && <LoadingOverlay overlay />}
      </div>
    </div>
  );
}