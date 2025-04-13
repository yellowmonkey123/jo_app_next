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
import PmHabitsStep from '@/components/shutdown/PmHabitsStep';

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
  const [loading, setLoading] = useState(true);
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
    };
    checkAuth();
  }, [router]);

  // --- Step Navigation ---
  const handleNextStep = (stepData: Partial<ShutdownFormData>) => {
    const updatedData = { ...stepData };
    if (typeof updatedData.accomplishment === 'string') {
        updatedData.accomplishment = updatedData.accomplishment.trim();
    }
     if (typeof updatedData.improvement === 'string') {
        updatedData.improvement = updatedData.improvement.trim();
    }
     if (updatedData.completed_pm_anytime_habits && !Array.isArray(updatedData.completed_pm_anytime_habits)) {
       console.warn("Received non-array for completed_pm_anytime_habits, correcting.");
       updatedData.completed_pm_anytime_habits = [];
     }
    setFormData(prevData => ({ ...prevData, ...updatedData }));

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
      handleSubmit({ ...formData, ...updatedData });
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
       router.push('/dashboard');
    }
  };

  // --- Form Submission ---
  const handleSubmit = async (finalData: ShutdownFormData) => {
    setLoading(true);
    setSubmitError(null);
    console.log('Submitting Shutdown Data:', finalData);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found for submission.");

      const today = new Date().toISOString().split('T')[0];

      const upsertData = {
          user_id: user.id,
          log_date: today,
          day_rating: finalData.day_rating,
          accomplishment: finalData.accomplishment,
          improvement: finalData.improvement,
          completed_pm_anytime_habits: finalData.completed_pm_anytime_habits,
          shutdown_completed_at: new Date().toISOString(),
      };

      const { error } = await supabase
          .from('daily_logs')
          .upsert(upsertData, { onConflict: 'user_id, log_date' });

      if (error) throw error;

      console.log('Data submitted successfully to Supabase!');
      router.push('/dashboard?shutdown=complete');

    // --- FIXED: Changed 'any' to 'unknown' and added type check ---
    } catch (error: unknown) {
       console.error("Submission Error:", error);
       // Set error message, checking if err is an Error instance
       setSubmitError(error instanceof Error ? error.message : "An error occurred while saving your shutdown routine.");
       // setLoading(false) happens in finally block now
    } finally {
        // --- NEW: Added finally block to ensure loading stops ---
        setLoading(false);
    }
  };

  // --- Render Logic ---
  const renderCurrentStep = () => {
    switch (currentStep) {
      case ShutdownStep.DAY_RATING:
        return (<DayRatingStep initialValue={formData.day_rating} onNext={handleNextStep} onBack={handlePrevStep} />);
      case ShutdownStep.ACCOMPLISHMENT:
        return (<AccomplishmentStep initialValue={formData.accomplishment} onNext={handleNextStep} onBack={handlePrevStep} />);
      case ShutdownStep.IMPROVEMENT:
         return (<ImprovementStep initialValue={formData.improvement} onNext={handleNextStep} onBack={handlePrevStep} />);
       case ShutdownStep.PM_ANYTIME_HABITS:
         return (<PmHabitsStep initialValue={formData.completed_pm_anytime_habits} onNext={handleNextStep} onBack={handlePrevStep} />);
      default:
         console.error("Invalid shutdown step:", currentStep);
         return <div>Error: Invalid step encountered.</div>;
    }
  };

  // --- Main Render (JSX remains the same) ---
  if (loading && !isAuthenticated) {
    return ( <div className="min-h-screen flex items-center justify-center"><svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div> );
  }
  if (!isAuthenticated) { return null; }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
       <div className="flex items-center justify-between mb-6 flex-wrap gap-4"><h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Evening Shutdown</h1><Link href="/dashboard" className="text-sm text-indigo-600 hover:underline" title="Cancel and return to Dashboard">Cancel</Link></div>
       {submitError && ( <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert"><strong className="font-bold">Save Error: </strong><span className="block sm:inline">{submitError}</span></div> )}
       <div className="bg-white shadow-md rounded-lg p-6 min-h-[300px]"> {renderCurrentStep()} </div>
       {/* Corrected loading state check - should only depend on loading, not currentStep */}
       {loading && !submitError && ( // Show loading overlay only when processing submission, not during initial auth check
         <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50"><div className="text-center"><svg className="animate-spin h-8 w-8 text-white mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><p className="text-white text-lg">Saving your progress...</p></div></div>
       )}
    </div>
  );
}