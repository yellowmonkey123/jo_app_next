'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react'; // Added useCallback
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { StartupStep, StartupFormData, DailyLog } from '@/types';
import Link from 'next/link';
import { useDailyLogStore } from '@/stores/dailyLogStore';
// Utility to get local date (assuming you have one, maybe move to lib/utils)
// Using the one defined locally for now, ensure consistency if also defined elsewhere
// import { getLocalDateString } from '@/lib/utils/dateUtils';

// --- Import Step Components ---
import PrevEveningRatingStep from '@/components/startup/PrevEveningRatingStep';
import SleepRatingStep from '@/components/startup/SleepRatingStep';
import MorningRatingStep from '@/components/startup/MorningRatingStep';
import FeelingStep from '@/components/startup/FeelingStep';
import AmHabitsStep from '@/components/startup/AmHabitsStep';
import ConfirmDeferredShutdownHabitsStep from '@/components/startup/ConfirmDeferredShutdownHabitsStep';
import LoadingSpinner from '@/components/LoadingSpinner'; // Assuming you have a LoadingSpinner component

// Define the actual steps in the sequence
// Using the enum directly avoids string mismatches
enum StartupSequence {
  CONFIRM_DEFERRED = 'confirm-deferred', // Custom identifier
  PREV_EVENING_RATING = StartupStep.PREV_EVENING_RATING, // 'prev-evening-rating'
  SLEEP_RATING = StartupStep.SLEEP_RATING,             // 'sleep-rating'
  MORNING_RATING = StartupStep.MORNING_RATING,         // 'morning-rating'
  FEELING = StartupStep.FEELING,                     // 'feeling-morning'
  AM_HABITS = StartupStep.AM_HABITS,                   // 'am-habits'
}

// Initial state for the form data
const initialFormData: StartupFormData = {
  prev_evening_rating: null,
  sleep_rating: null,
  morning_rating: null,
  feeling_morning: '',
  completed_am_habits: [],
};

// Helper function (consider moving to utils if used elsewhere)
function getLocalDateString(timezone: string): string {
    try {
        const date = new Date();
        // 'en-CA' locale often givesModuleInitFlag-MM-DD format
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
        });
        return formatter.format(date);
    } catch (e) {
        console.error(`Failed to format date for timezone ${timezone}:`, e);
        // Fallback to UTC date string
        return new Date().toISOString().split('T')[0];
    }
}


export default function StartupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<StartupFormData>(initialFormData);
  const [userId, setUserId] = useState<string | null>(null);
  const [userTimezone, setUserTimezone] = useState<string>('UTC');
  // Combined loading state for initialization (auth, profile, logs)
  const [isLoading, setIsLoading] = useState(true);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // --- Zustand Store Access ---
  const {
    yesterdayLog,
    loading: storeLoading, // Use store loading state during fetch
    error: storeError,
    fetchLogs
  } = useDailyLogStore();

  // --- Determine if confirmation step is needed (only *after* logs are loaded) ---
  const showConfirmationStep = useMemo(() => {
      // Check only if logs are loaded and yesterday's log exists
      // Use storeLoading to know when fetchLogs is done
      if (storeLoading || !yesterdayLog) return false;
      return (yesterdayLog.deferred_from_shutdown?.length ?? 0) > 0;
  }, [yesterdayLog, storeLoading]); // Depend on yesterdayLog and loading status

  // --- Define the order of steps dynamically ---
  const stepOrder = useMemo(() => {
      const baseSteps: StartupSequence[] = [
          StartupSequence.PREV_EVENING_RATING,
          StartupSequence.SLEEP_RATING,
          StartupSequence.MORNING_RATING,
          StartupSequence.FEELING,
          StartupSequence.AM_HABITS,
      ];
      // Prepend confirmation step if needed (determined after logs loaded)
      return showConfirmationStep ? [StartupSequence.CONFIRM_DEFERRED, ...baseSteps] : baseSteps;
  }, [showConfirmationStep]);

  // --- Current Step State ---
  // Initialize AFTER determining the actual step order based on fetched logs
  const [currentStep, setCurrentStep] = useState<StartupSequence | null>(null);

  // --- Combined Authentication and Initial Data Fetching Effect ---
  useEffect(() => {
    let isMounted = true;
    const initializeSequence = async () => {
      setIsLoading(true); // Start overall loading
      setInitializationError(null);
      try {
        // 1. Auth Check
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session?.user?.id) {
          if (isMounted) router.push('/auth/signin');
          return;
        }
        const fetchedUserId = session.user.id;
        if (!isMounted) return;
        setUserId(fetchedUserId); // Set user ID

        // 2. Fetch Timezone
        let fetchedTimezone = 'UTC';
        try {
            const { data: profileData, error: profileError } = await supabase
                .from('profiles').select('timezone').eq('id', fetchedUserId).single();
            // Ignore 'PGRST116' (No rows found) error, just use default
            if (profileError && profileError.code !== 'PGRST116') throw profileError;
            if (profileData?.timezone) fetchedTimezone = profileData.timezone;
        } catch (profileFetchError) {
            console.error("Failed to fetch profile timezone, using default:", profileFetchError);
            if (isMounted) setInitializationError("Could not load timezone setting.");
            // Proceed with default UTC
        }
        if (!isMounted) return;
        setUserTimezone(fetchedTimezone);

        // 3. Fetch Logs via Zustand Store Action
        await fetchLogs(fetchedUserId, fetchedTimezone);
        // Logs are now fetched (or failed with storeError set)

        // 4. Set Initial Step (Now that logs are potentially loaded)
        // Need to get the latest state from the store *after* fetchLogs completes
        // Using a slight delay or relying on useMemo dependency might be needed if state update isn't immediate
        // For simplicity, let's calculate based on the state *after* await
        const currentYesterdayLog = useDailyLogStore.getState().yesterdayLog;
        const shouldShowConfirmation = (currentYesterdayLog?.deferred_from_shutdown?.length ?? 0) > 0;
        const initialStep = shouldShowConfirmation
            ? StartupSequence.CONFIRM_DEFERRED
            : StartupSequence.PREV_EVENING_RATING; // Default first step

        if (isMounted) {
            setCurrentStep(initialStep);
        }

      } catch (error) {
        console.error("Initialization failed:", error);
        if (isMounted) {
            setInitializationError(error instanceof Error ? error.message : "Failed to initialize sequence.");
        }
      } finally {
        if (isMounted) {
            setIsLoading(false); // Finish overall initialization loading
        }
      }
    };

    initializeSequence();
    return () => { isMounted = false; }; // Cleanup function
  }, [router, fetchLogs]); // fetchLogs dependency from store

  // --- Step Navigation (Uses dynamic stepOrder) ---
   const handleNextStep = useCallback((stepData?: Partial<StartupFormData>) => {
    if (!currentStep) return; // Don't navigate if initial step isn't set yet

    if (stepData) {
        // Basic validation/cleanup before merging
        const updatedData = { ...stepData };
        if (typeof updatedData.feeling_morning === 'string') {
            updatedData.feeling_morning = updatedData.feeling_morning.trim();
        }
        if (updatedData.completed_am_habits && !Array.isArray(updatedData.completed_am_habits)) {
            updatedData.completed_am_habits = [];
        }
        setFormData(prevData => ({ ...prevData, ...updatedData }));
    }

    const currentStepIndex = stepOrder.indexOf(currentStep);
    const nextStepIndex = currentStepIndex + 1;

    if (nextStepIndex < stepOrder.length) {
      setCurrentStep(stepOrder[nextStepIndex]);
    } else {
      // If it's the last step, trigger submission
      // Ensure the final step's data is included
      handleSubmit({ ...formData, ...(stepData || {}) });
    }
  }, [currentStep, stepOrder, formData, handleSubmit]); // Added formData dependency

  const handlePrevStep = useCallback(() => {
    if (!currentStep) return;
    const currentStepIndex = stepOrder.indexOf(currentStep);
    const prevStepIndex = currentStepIndex - 1;
    if (prevStepIndex >= 0) {
      setCurrentStep(stepOrder[prevStepIndex]);
    } else {
       router.push('/dashboard'); // Go back to dashboard if on the first step
    }
  }, [currentStep, stepOrder, router]);

  // --- Form Submission ---
  async function handleSubmit(finalData: StartupFormData) {
    if (!userId) { setSubmitError("User not identified."); return; }
    setIsSubmitting(true);
    setSubmitError(null);
    console.log('Submitting Startup Data:', finalData);

    try {
        const localDate = getLocalDateString(userTimezone);

        // Prepare data for upsert, ensuring correct types and handling nulls
        const upsertData: Partial<DailyLog> & { user_id: string; log_date: string } = {
            user_id: userId,
            log_date: localDate,
            // Use undefined if null to avoid overwriting existing DB values with null
            prev_evening_rating: finalData.prev_evening_rating ?? undefined,
            sleep_rating: finalData.sleep_rating ?? undefined,
            morning_rating: finalData.morning_rating ?? undefined,
            feeling_morning: finalData.feeling_morning,
            completed_am_habits: finalData.completed_am_habits ?? [],
            startup_completed_at: new Date().toISOString(),
        };

        // Remove undefined keys to prevent errors during upsert if column defaults exist
        Object.keys(upsertData).forEach(key => {
          if (upsertData[key as keyof typeof upsertData] === undefined) {
            delete upsertData[key as keyof typeof upsertData];
          }
        });


        const { error: upsertError } = await supabase
            .from('daily_logs')
            .upsert(upsertData, {
                onConflict: 'user_id, log_date' // Assumes unique constraint
            });

        if (upsertError) throw upsertError;

        // --- Clear relevant store state after successful submission? ---
        // Maybe clear yesterdayLog if confirmation was handled? TBD
        // useDailyLogStore.setState({ yesterdayLog: null }); // Example

        router.push('/dashboard?startup=complete'); // Redirect on success

    } catch (error) {
        console.error("Submission Error:", error);
        setSubmitError(error instanceof Error ? error.message : "Failed to save startup.");
    } finally {
        setIsSubmitting(false);
    }
  };

  // --- Render Logic (Handles initialization states) ---
  const renderCurrentStep = () => {
     // Handle Initialization errors first
     if (initializationError) {
        return <div className="text-center text-red-600 p-4">Error loading page: {initializationError}</div>;
     }
     // Handle Store fetch errors
     if (storeError) {
         return <div className="text-center text-red-600 p-4">Error loading routine data: {storeError}</div>;
     }
     // Show loading during initial auth/profile/log fetch OR if currentStep isn't set yet
     if (isLoading || !currentStep) {
        return ( <div className="min-h-[200px] flex items-center justify-center"><LoadingSpinner /></div> );
     }

     // If initialized and no errors, render the current step
     if (userId) {
         switch (currentStep) {
           case StartupSequence.CONFIRM_DEFERRED:
             // Pass necessary props if ConfirmDeferredShutdownHabitsStep needs them
             return ( <ConfirmDeferredShutdownHabitsStep onNext={() => handleNextStep()} onBack={handlePrevStep} /> );
           case StartupSequence.PREV_EVENING_RATING:
             return ( <PrevEveningRatingStep initialValue={formData.prev_evening_rating} onNext={(data) => handleNextStep(data)} onBack={handlePrevStep} /> );
           // --- *** ADDED MISSING CASES *** ---
           case StartupSequence.SLEEP_RATING:
             return ( <SleepRatingStep initialValue={formData.sleep_rating} onNext={(data) => handleNextStep(data)} onBack={handlePrevStep} /> );
           case StartupSequence.MORNING_RATING:
             return ( <MorningRatingStep initialValue={formData.morning_rating} onNext={(data) => handleNextStep(data)} onBack={handlePrevStep} /> );
           case StartupSequence.FEELING:
             return ( <FeelingStep initialValue={formData.feeling_morning} onNext={(data) => handleNextStep(data)} onBack={handlePrevStep} /> );
           // --- *** END ADDED CASES *** ---
           case StartupSequence.AM_HABITS:
              // Pass habit IDs that were marked done in this session
              return ( <AmHabitsStep initialValue={formData.completed_am_habits} onNext={(data) => handleNextStep(data)} onBack={handlePrevStep} /> );
           default:
             // Log the specific invalid step value for debugging
             console.error("Invalid startup step:", currentStep);
             return <div className="text-center text-red-600 p-4">Error: Invalid step state.</div>;
         }
     }
     // Should not be reached if auth logic is correct, but added for safety
     return <div className="text-center text-red-600 p-4">Error: User not identified.</div>;
   };

  // --- Main Page Render ---
  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
       <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
           <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Morning Startup</h1>
           {userId && !isSubmitting && (
               <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline" title="Cancel and return to Dashboard">
                   Cancel
               </Link>
           )}
       </div>

       {/* Submission Error Display */}
       {submitError && (
           <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
               <strong className="font-bold">Error:</strong>
               <span className="block sm:inline"> {submitError}</span>
           </div>
       )}

       {/* Main Step Content Area */}
       <div className="bg-white shadow-md rounded-lg p-6 min-h-[300px] relative">
           {/* Render step or loading/error states */}
           {renderCurrentStep()}

           {/* Submission Loading Overlay */}
           {isSubmitting && (
               <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center z-10 rounded-lg">
                   <LoadingSpinner />
                   <span className="ml-2 text-gray-700">Saving...</span>
               </div>
           )} {/* <-- *** FIXED: Added missing closing parenthesis *** */}
       </div>
    </div>
  );
}
