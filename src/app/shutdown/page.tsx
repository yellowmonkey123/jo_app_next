'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { ShutdownStep, Rating } from '@/types'; // Assuming these are defined in @/types
import Link from 'next/link';

// --- Import Step Components ---
import DayRatingStep from '@/components/shutdown/DayRatingStep';
import AccomplishmentStep from '@/components/shutdown/AccomplishmentStep';
import ImprovementStep from '@/components/shutdown/ImprovementStep';
import PmHabitsStep from '@/components/shutdown/PmHabitsStep'; // <-- NEW Import

// Define the structure for the data collected in this form
export interface ShutdownFormData {
  day_rating: Rating | null;
  accomplishment: string;
  improvement: string;
  completed_pm_anytime_habits: string[]; // Array of completed habit IDs
}

// Initial state for the form data
const initialFormData: ShutdownFormData = {
  day_rating: null,
  accomplishment: '',
  improvement: '',
  completed_pm_anytime_habits: [],
};

export default function ShutdownPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<ShutdownStep>(ShutdownStep.DAY_RATING);
  const [formData, setFormData] = useState<ShutdownFormData>(initialFormData);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true); // Handles initial auth check and final submission
  const [submitError, setSubmitError] = useState<string | null>(null);

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
      // TODO: Fetch existing log data for today if user revisits
      // Check if startup was completed? Should shutdown be available?
    };
    checkAuth();
  }, [router]);

  // --- Step Navigation ---
  const handleNextStep = (stepData: Partial<ShutdownFormData>) => {
    // Update form data with data from the completed step
    const updatedData = { ...stepData };
    if (typeof updatedData.accomplishment === 'string') {
        updatedData.accomplishment = updatedData.accomplishment.trim();
    }
     if (typeof updatedData.improvement === 'string') {
        updatedData.improvement = updatedData.improvement.trim();
    }
     // Ensure completed_pm_anytime_habits is always an array
     if (updatedData.completed_pm_anytime_habits && !Array.isArray(updatedData.completed_pm_anytime_habits)) {
       console.warn("Received non-array for completed_pm_anytime_habits, correcting.");
       updatedData.completed_pm_anytime_habits = [];
     }

    setFormData(prevData => ({ ...prevData, ...updatedData }));

    // Determine the next step
    const stepOrder = [
      ShutdownStep.DAY_RATING,
      ShutdownStep.ACCOMPLISHMENT,
      ShutdownStep.IMPROVEMENT,
      ShutdownStep.PM_ANYTIME_HABITS,
    ];
    const currentStepIndex = stepOrder.indexOf(currentStep);
    const nextStepIndex = currentStepIndex + 1;

    if (nextStepIndex < stepOrder.length) {
      setCurrentStep(stepOrder[nextStepIndex]);
    } else {
      // If it was the last step (PM_ANYTIME_HABITS), the 'Complete Shutdown' button
      // in PmHabitsStep calls this function, triggering the final submit.
      handleSubmit({ ...formData, ...updatedData }); // Pass the final combined data
    }
  };

  const handlePrevStep = () => {
    const stepOrder = [
      ShutdownStep.DAY_RATING,
      ShutdownStep.ACCOMPLISHMENT,
      ShutdownStep.IMPROVEMENT,
      ShutdownStep.PM_ANYTIME_HABITS,
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
  const handleSubmit = async (finalData: ShutdownFormData) => {
    setLoading(true); // Indicate processing
    setSubmitError(null);
    console.log('Submitting Shutdown Data:', finalData);

    // --- Implement Actual Supabase Upsert Logic ---
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found for submission.");

      const today = new Date().toISOString().split('T')[0]; // Get YYYY-MM-DD

      // Prepare data for upsert, ensuring nulls/defaults if needed
      const upsertData = {
          user_id: user.id,
          log_date: today,
          day_rating: finalData.day_rating,
          accomplishment: finalData.accomplishment,
          improvement: finalData.improvement,
          completed_pm_anytime_habits: finalData.completed_pm_anytime_habits,
          shutdown_completed_at: new Date().toISOString(), // Set completion timestamp
      };

      // Upsert into daily_logs table based on user_id and log_date
      // This will update the existing row for the day or insert if it doesn't exist
      const { error } = await supabase
          .from('daily_logs')
          .upsert(upsertData, { onConflict: 'user_id, log_date' }); // Specify conflict target

      if (error) throw error; // Throw error if Supabase returns one

      console.log('Data submitted successfully to Supabase!');
      router.push('/dashboard?shutdown=complete'); // Redirect on success

    } catch (error: any) {
       console.error("Submission Error:", error);
       setSubmitError(error.message || "An error occurred while saving your shutdown routine.");
       setLoading(false); // Stop loading indicator on error
    }
    // setLoading should stop on error or redirect
  };


  // --- Render Logic ---
  const renderCurrentStep = () => {
    switch (currentStep) {
      case ShutdownStep.DAY_RATING:
        return (
          <DayRatingStep
            initialValue={formData.day_rating}
            onNext={handleNextStep}
            onBack={handlePrevStep}
          />
        );
      case ShutdownStep.ACCOMPLISHMENT:
        return (
          <AccomplishmentStep
            initialValue={formData.accomplishment}
            onNext={handleNextStep}
            onBack={handlePrevStep}
          />
        );
      case ShutdownStep.IMPROVEMENT:
         return (
           <ImprovementStep
             initialValue={formData.improvement}
             onNext={handleNextStep}
             onBack={handlePrevStep}
           />
         );
       case ShutdownStep.PM_ANYTIME_HABITS:
         // --- MODIFIED: Use the actual component ---
         return (
           <PmHabitsStep
             initialValue={formData.completed_pm_anytime_habits} // Pass correct initial value
             onNext={handleNextStep} // Pass the function to trigger final submit
             onBack={handlePrevStep} // Pass the function to handle moving back
           />
         );
      default:
         console.error("Invalid shutdown step:", currentStep);
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
         <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Evening Shutdown</h1>
         {/* TODO: Add a progress indicator (e.g., Step 4 of 4) */}
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
         {renderCurrentStep()}
       </div>

       {/* Global loading overlay for final submission */}
       {/* Show loading overlay only when loading state is true during the final step or after */}
       {loading && currentStep === ShutdownStep.PM_ANYTIME_HABITS && (
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
