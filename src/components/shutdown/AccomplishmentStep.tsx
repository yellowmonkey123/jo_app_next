'use client';

import { useState, useEffect, ChangeEvent } from 'react'; // Import ChangeEvent
import { ShutdownFormData } from '@/app/shutdown/page'; // Adjust path if needed

// Define the props the component expects
interface AccomplishmentStepProps {
  initialValue: string; // The current value from the main form data
  onNext: (data: Partial<ShutdownFormData>) => void; // Callback to proceed to next step
  onBack: () => void; // Callback to go back
}

export default function AccomplishmentStep({ initialValue, onNext, onBack }: AccomplishmentStepProps) {
  // State to hold the user's text input within this step
  const [accomplishmentText, setAccomplishmentText] = useState<string>(initialValue);
  // State for simple validation feedback
  const [validationError, setValidationError] = useState<string | null>(null);


  // Update internal state if the initialValue prop changes (e.g., user navigates back)
  useEffect(() => {
    setAccomplishmentText(initialValue);
  }, [initialValue]);

  // Handle clicking the 'Next' button
  const handleNextClick = () => {
    const trimmedText = accomplishmentText.trim();
    // Basic validation: Ensure some text is entered
    if (!trimmedText) {
       setValidationError('Please enter at least one accomplishment.');
       return; // Prevent moving to the next step
    }
    setValidationError(null);
    onNext({ accomplishment: trimmedText });
  };

  // Clear validation error when user starts typing
  const handleTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => { // Use specific event type
      setAccomplishmentText(e.target.value);
      if (validationError) {
          setValidationError(null);
      }
  }

  return (
    <div className="space-y-6">
      {/* --- FIXED: Replaced ' with &apos; --- */}
      <h2 className="text-xl font-semibold text-gray-800">Today&apos;s Accomplishment</h2>

      {/* Instructions */}
      <p className="text-gray-600">
        What is one thing, big or small, that you feel you accomplished today?
      </p>

      {/* Text Input Area */}
      <div>
        <label htmlFor="accomplishment-text" className="sr-only">
          Your accomplishment
        </label>
        <textarea
          id="accomplishment-text"
          rows={4}
          className={`block w-full rounded-md border shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 ${
             validationError ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="e.g., Finished the project report, went for a walk, cooked a nice meal..."
          value={accomplishmentText}
          onChange={handleTextChange}
        />
         {validationError && (
             <p className="mt-2 text-sm text-red-600">{validationError}</p>
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
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Next
        </button>
      </div>
    </div>
  );
}