'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { ShutdownStep, Rating, Habit, ShutdownFormData, DailyLog } from '@/types';
import Link from 'next/link';
import { useDailyLogStore } from '@/stores/dailyLogStore';

// --- Import Step Components ---
import DayRatingStep from '@/components/shutdown/DayRatingStep';
import AccomplishmentStep from '@/components/shutdown/AccomplishmentStep';
import ImprovementStep from '@/components/shutdown/ImprovementStep';
import PmHabitsStep from '@/components/shutdown/PmHabitsStep';
import ConfirmDeferredStartupHabitsStep from '@/components/shutdown/ConfirmDeferredStartupHabitsStep';

// Define the actual steps in the sequence
enum ShutdownSequence {
  CONFIRM_DEFERRED = 'confirm-deferred',
  DAY_RATING = ShutdownStep.DAY_RATING,
  ACCOMPLISHMENT = ShutdownStep.ACCOMPLISHMENT,
  IMPROVEMENT = ShutdownStep.IMPROVEMENT,
  PM_ANYTIME_HABITS = ShutdownStep.PM_ANYTIME_HABITS,
}

// Initial state for the form data
const initialFormData: ShutdownFormData = {
  day_rating: null,
  accomplishment: '',
  improvement: '',
  completed_pm_anytime_habits: [],
};

// Helper function
function getLocalDateString(timezone: string): string {
    try {
        const date = new Date();
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
        });
        return formatter.format(date);
    } catch (e) {
        console.error(`Failed to format date for timezone ${timezone}:`, e);
        return new Date().toISOString().split('T')[0]; // Fallback
    }
}

export default function ShutdownPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<ShutdownFormData>(initialFormData);
  const [userId, setUserId] = useState<string | null>(null);
  const [userTimezone, setUserTimezone] = useState<string>('UTC');
  const [isLoading, setIsLoading] = useState(true); // Combined init loading
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // --- Zustand Store Access ---
  const {
    todayLog, // Need today's log for confirmation check
    loading: storeLoading,
    error: storeError,
    fetchLogs
  } = useDailyLogStore();

  // --- Determine if confirmation step is needed ---
  const showConfirmationStep = useMemo(() => {
      if (storeLoading || !todayLog) return false;
      return (todayLog.deferred_from_startup?.length ?? 0) > 0;
  }, [todayLog, storeLoading]);

  // --- Define the order of steps dynamically ---
  const stepOrder = useMemo(() => {
      const baseSteps = [
          ShutdownSequence.DAY_RATING,
          ShutdownSequence.ACCOMPLISHMENT,
          ShutdownSequence.IMPROVEMENT,
          ShutdownSequence.PM_ANYTIME_HABITS,
      ];
      return showConfirmationStep ? [ShutdownSequence.CONFIRM_DEFERRED, ...baseSteps] : baseSteps;
  }, [showConfirmationStep]);

  // --- Current Step State ---
  const [currentStep, setCurrentStep] = useState<ShutdownSequence | null>(null);

  // --- Combined Authentication and Initial Data Fetching Effect ---
  useEffect(() => {
    let isMounted = true;
    const initializeSequence = async () => {
      setIsLoading(true);
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
        setUserId(fetchedUserId);

        // 2. Fetch Timezone
        let fetchedTimezone = 'UTC';
        try {
            const { data: profileData, error: profileError } = await supabase
                .from('profiles').select('timezone').eq('id', fetchedUserId).single();
            if (profileError && profileError.code !== 'PGRST116') throw profileError;
            if (profileData?.timezone) fetchedTimezone = profileData.timezone;
        } catch (profileFetchError) {
            console.error("Failed to fetch profile timezone, using default:", profileFetchError);
            if (isMounted) setInitializationError("Could not load timezone setting.");
        }
        if (!isMounted) return;
        setUserTimezone(fetchedTimezone);

        // 3. Fetch Logs via Zustand Store Action
        await fetchLogs(fetchedUserId, fetchedTimezone);

        // 4. Set Initial Step (after logs are potentially loaded)
        const currentTodayLog = useDailyLogStore.getState().todayLog; // Get latest state
        const shouldShowConfirmation = (currentTodayLog?.deferred_from_startup?.length ?? 0) > 0;
        const initialStep = shouldShowConfirmation
            ? ShutdownSequence.CONFIRM_DEFERRED
            : ShutdownSequence.DAY_RATING;

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
            setIsLoading(false);
        }
      }
    };
    initializeSequence();
    return () => { isMounted = false; };
  }, [router, fetchLogs]);

  // --- Step Navigation (Uses dynamic stepOrder) ---
   const handleNextStep = (stepData?: Partial<ShutdownFormData>) => {
    if (!currentStep) return;
    if (stepData) {
        // Basic validation/cleanup
        const updatedData = { ...stepData };
         if (typeof updatedData.accomplishment === 'string') {
             updatedData.accomplishment = updatedData.accomplishment.trim();
         }
         if (typeof updatedData.improvement === 'string') {
             updatedData.improvement = updatedData.improvement.trim();
         }
         if (updatedData.completed_pm_anytime_habits && !Array.isArray(updatedData.completed_pm_anytime_habits)) {
            updatedData.completed_pm_anytime_habits = [];
         }
        setFormData(prevData => ({ ...prevData, ...updatedData }));
    }
    const currentStepIndex = stepOrder.indexOf(currentStep);
    const nextStepIndex = currentStepIndex + 1;
    if (nextStepIndex < stepOrder.length) {
      setCurrentStep(stepOrder[nextStepIndex]);
    } else {
      handleSubmit({ ...formData, ...(stepData || {}) });
    }
  };

  const handlePrevStep = () => {
    if (!currentStep) return;
    const currentStepIndex = stepOrder.indexOf(currentStep);
    const prevStepIndex = currentStepIndex - 1;
    if (prevStepIndex >= 0) {
      setCurrentStep(stepOrder[prevStepIndex]);
    } else {
       router.push('/dashboard');
    }
  };

  // --- Form Submission (Includes rating fix) ---
  const handleSubmit = async (finalData: ShutdownFormData) => {
      if (!userId) { setSubmitError("User not identified."); return; }
      setIsSubmitting(true);
      setSubmitError(null);
      console.log('Submitting Shutdown Data:', finalData);
      try {
          const localDate = getLocalDateString(userTimezone);
          const upsertData: Partial<DailyLog> & { user_id: string; log_date: string } = {
              user_id: userId,
              log_date: localDate,
              day_rating: finalData.day_rating ?? undefined, // Fix type mismatch
              accomplishment: finalData.accomplishment,
              improvement: finalData.improvement,
              completed_pm_anytime_habits: finalData.completed_pm_anytime_habits ?? [],
              shutdown_completed_at: new Date().toISOString(),
          };
          const { error: upsertError } = await supabase
              .from('daily_logs').upsert(upsertData, { onConflict: 'user_id, log_date' });
          if (upsertError) throw upsertError;
          router.push('/dashboard?shutdown=complete');
      } catch (error) {
          console.error("Submission Error:", error);
          setSubmitError(error instanceof Error ? error.message : "Failed to save shutdown.");
      } finally {
          setIsSubmitting(false);
      }
  };

  // --- Render Logic (Handles initialization states) ---
  const renderCurrentStep = () => {
     if (initializationError) { return <div className="text-center text-red-600 p-4">Error loading page: {initializationError}</div>; }
     if (storeError) { return <div className="text-center text-red-600 p-4">Error loading routine data: {storeError}</div>; }
     // Use isLoading for combined auth/profile/log fetch loading
     if (isLoading || !currentStep) {
        return ( <div className="min-h-[200px] flex items-center justify-center"> {/* Loading Spinner */} </div> );
     }
     if (userId) {
         switch (currentStep) {
           case ShutdownSequence.CONFIRM_DEFERRED:
             return ( <ConfirmDeferredStartupHabitsStep onNext={handleNextStep} onBack={handlePrevStep} /> );
           case ShutdownSequence.DAY_RATING:
             return (<DayRatingStep initialValue={formData.day_rating} onNext={handleNextStep} onBack={handlePrevStep} />);
           case ShutdownSequence.ACCOMPLISHMENT:
             return (<AccomplishmentStep initialValue={formData.accomplishment} onNext={handleNextStep} onBack={handlePrevStep} />);
           case ShutdownSequence.IMPROVEMENT:
              return (<ImprovementStep initialValue={formData.improvement} onNext={handleNextStep} onBack={handlePrevStep} />);
            case ShutdownSequence.PM_ANYTIME_HABITS:
              return (<PmHabitsStep initialValue={formData.completed_pm_anytime_habits} onNext={handleNextStep} onBack={handlePrevStep} />);
           default:
              console.error("Invalid shutdown step:", currentStep);
              return <div className="text-center text-red-600 p-4">Error: Invalid step state.</div>;
         }
     }
     return null;
   };

  // --- Main Page Render ---
  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
       <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
           <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Evening Shutdown</h1>
           {userId && !isSubmitting && (
               <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline" title="Cancel and return to Dashboard">
                   Cancel
               </Link>
           )}
       </div>
       {submitError && (
           <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
              {/* ... Error display ... */}
           </div>
       )}
       <div className="bg-white shadow-md rounded-lg p-6 min-h-[300px]">
           {renderCurrentStep()}
       </div>
       {isSubmitting && (
         <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
            {/* ... Loading overlay ... */}
         </div>
       )}
    </div>
  );
}