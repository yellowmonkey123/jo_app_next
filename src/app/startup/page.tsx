'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { StartupStep, Rating } from '@/types'; // Assuming these are defined in @/types
import Link from 'next/link';

// --- Import Step Components ---
import PrevEveningRatingStep from '@/components/startup/PrevEveningRatingStep';
import SleepRatingStep from '@/components/startup/SleepRatingStep';
import MorningRatingStep from '@/components/startup/MorningRatingStep';
import FeelingStep from '@/components/startup/FeelingStep';
import AmHabitsStep from '@/components/startup/AmHabitsStep'; // <-- NEW Import


// Define the structure for the data collected in this form
export interface StartupFormData {
  prev_evening_rating: Rating | null;
  sleep_rating: Rating | null;
  morning_rating: Rating | null;
  feeling_morning: string;
  completed_am_habits: string[]; // Array of completed habit IDs
}

// Initial state for the form data
const initialFormData: StartupFormData = {
  prev_evening_rating: null,
  sleep_rating: null,
  morning_rating: null,
  feeling_morning: '',
  completed_am_habits: [],
};

export default function StartupPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<StartupStep>(StartupStep.PREV_EVENING_RATING);
  const [formData, setFormData] = useState<StartupFormData>(initialFormData);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true); // Handles initial auth check and final submission
  const [submitError, setSubmitError] = useState<string | null>(null); // State for submission errors

  // --- Authentication Check ---
  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/signin');
        return;
      }
      setIsAuthenticated(true);
      setLoading(false);
      // TODO: Fetch existing log data for today if user revisits and pre-fill form
      // This would involve fetching from 'daily_logs' and setting formData and potentially currentStep
    };
    checkAuth();
  }, [router]);

  // --- Step Navigation ---
  const handleNextStep = (stepData: Partial<StartupFormData>) => {
    // Update form data, trimming feeling_morning if present
    const updatedData = { ...stepData };
    if (typeof updatedData.feeling_morning === 'string') {
        updatedData.feeling_morning = updatedData.feeling_morning.trim();
    }
    // Ensure completed_am_habits is always an array
     if (updatedData.completed_am_habits && !Array.isArray(updatedData.completed_am_habits)) {
       console.warn("Received non-array for completed_am_habits, correcting.");
       updatedData.completed_am_habits = []; // Or handle appropriately
     }

    setFormData(prevData => ({ ...prevData, ...updatedData }));

    // Determine next step or submit
    const stepOrder = [
      StartupStep.PREV_EVENING_RATING,
      StartupStep.SLEEP_RATING,
      StartupStep.MORNING_RATING,
      StartupStep.FEELING,
      StartupStep.AM_HABITS,
    ];
    const currentStepIndex = stepOrder.indexOf(currentStep);
    const nextStepIndex = currentStepIndex + 1;

    if (nextStepIndex < stepOrder.length) {
      setCurrentStep(stepOrder[nextStepIndex]);
    } else {
      // If it was the last step (AM_HABITS), the 'Complete Startup' button
      // in AmHabitsStep calls this function, triggering the final submit.
      handleSubmit({ ...formData, ...updatedData }); // Pass the final combined data
    }
  };

  const handlePrevStep = () => {
    const stepOrder = [
      StartupStep.PREV_EVENING_RATING,
      StartupStep.SLEEP_RATING,
      StartupStep.MORNING_RATING,
      StartupStep.FEELING,
      StartupStep.AM_HABITS,
    ];
    const currentStepIndex = stepOrder.indexOf(currentStep);
    const prevStepIndex = currentStepIndex - 1;

    if (prevStepIndex >= 0) {
      setCurrentStep(stepOrder[prevStepIndex]);
    } else {
       router.push('/dashboard'); // Go back to dashboard from first step
    }
  };

  // --- Form Submission ---
  // Modified to accept final data, though handleNextStep prepares it too
  const handleSubmit = async (finalData: StartupFormData) => {
    setLoading(true);
    setSubmitError(null); // Clear previous submission errors
    console.log('Submitting Startup Data:', finalData);

    // --- TODO: Implement Actual Supabase Upsert Logic ---
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found for submission.");

      const today = new Date().toISOString().split('T')[0]; // Get YYYY-MM-DD

      // Prepare data for upsert, ensuring nulls for missing ratings if needed
      const upsertData = {
          user_id: user.id,
          log_date: today,
          prev_evening_rating: finalData.prev_evening_rating,
          sleep_rating: finalData.sleep_rating,
          morning_rating: finalData.morning_rating,
          feeling_morning: finalData.feeling_morning,
          completed_am_habits: finalData.completed_am_habits,
          startup_completed_at: new Date().toISOString(), // Set completion timestamp
          // updated_at will be handled by Supabase trigger or default
      };

      // Upsert into daily_logs table based on user_id and log_date
      const { error } = await supabase
          .from('daily_logs')
          .upsert(upsertData, { onConflict: 'user_id, log_date' }); // Specify conflict target

      if (error) throw error;

      console.log('Data submitted successfully to Supabase!');
      router.push('/dashboard?startup=complete'); // Redirect on success

    } catch (error: any) {
       console.error("Submission Error:", error);
       setSubmitError(error.message || "An error occurred while saving your startup routine.");
       setLoading(false); // Stop loading indicator on error
    }
    // setLoading should stop on error or redirect
  };


  // --- Render Logic ---
  const renderCurrentStep = () => {
    switch (currentStep) {
      case StartupStep.PREV_EVENING_RATING:
        return (
          <PrevEveningRatingStep
            initialValue={formData.prev_evening_rating}
            onNext={handleNextStep}
            onBack={handlePrevStep}
          />
        );
      case StartupStep.SLEEP_RATING:
        return (
          <SleepRatingStep
            initialValue={formData.sleep_rating}
            onNext={handleNextStep}
            onBack={handlePrevStep}
          />
        );
      case StartupStep.MORNING_RATING:
         return (
           <MorningRatingStep
             initialValue={formData.morning_rating}
             onNext={handleNextStep}
             onBack={handlePrevStep}
           />
         );
       case StartupStep.FEELING:
         return (
           <FeelingStep
             initialValue={formData.feeling_morning}
             onNext={handleNextStep}
             onBack={handlePrevStep}
           />
         );
       case StartupStep.AM_HABITS:
         // --- MODIFIED: Use the actual component ---
         return (
           <AmHabitsStep
             initialValue={formData.completed_am_habits} // Pass correct initial value
             onNext={handleNextStep} // Pass the function to trigger final submit
             onBack={handlePrevStep} // Pass the function to handle moving back
           />
         );
      default:
        // Should not happen if currentStep state is managed correctly
        // Maybe render a fallback or error message
        console.error("Invalid startup step:", currentStep);
        return <div>Error: Invalid step encountered.</div>;
    }
  };

  // --- Main Render ---
  if (loading && !isAuthenticated) {
    // Show loading spinner only during initial auth check
    return (
      <div className="min-h-screen flex items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Redirect happens in useEffect
  }

  // Render the multi-step form container
  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
       <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
         <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Morning Startup</h1>
         {/* TODO: Add a progress indicator (e.g., Step 5 of 5) */}
         <Link
           href="/dashboard"
           className="text-sm text-indigo-600 hover:underline"
           title="Cancel and return to Dashboard"
         >
           Cancel
         </Link>
       </div>

       {/* Display submission error if any */}
       {submitError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
             <strong className="font-bold">Save Error: </strong>
             <span className="block sm:inline">{submitError}</span>
          </div>
        )}

       <div className="bg-white shadow-md rounded-lg p-6 min-h-[300px]">
         {/* Render the component for the current step */}
         {renderCurrentStep()}
       </div>

       {/* Global loading overlay for final submission */}
       {/* Check loading state directly instead of step */}
       {loading && currentStep === StartupStep.AM_HABITS && ( // Keep condition for clarity or remove step check if loading is only true on submit
         <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
            <div className="text-center">
                <svg className="animate-spin h-8 w-8 text-white mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-white text-lg">Saving your progress...</p>
            </div>
         </div>
       )}
    </div>
  );
}
