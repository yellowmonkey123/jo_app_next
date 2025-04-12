'use client';

import { useState, useEffect } from 'react';
import { StartupFormData } from '@/app/startup/page'; // Adjust path if needed, or define locally

// Define the props the component expects
interface FeelingStepProps {
  initialValue: string; // The current value from the main form data
  onNext: (data: Partial<StartupFormData>) => void; // Callback to proceed to next step
  onBack: () => void; // Callback to go back
}

export default function FeelingStep({ initialValue, onNext, onBack }: FeelingStepProps) {
  // State to hold the user's text input within this step
  const [feelingText, setFeelingText] = useState<string>(initialValue);

  // Update internal state if the initialValue prop changes (e.g., user navigates back)
  useEffect(() => {
    setFeelingText(initialValue);
  }, [initialValue]);

  // Handle clicking the 'Next' button
  const handleNextClick = () => {
    // Call the onNext prop passed from the parent page,
    // providing the data for this step (feeling_morning).
    // We trim the text but allow empty strings if the user doesn't enter anything.
    onNext({ feeling_morning: feelingText.trim() });
  };

  return (
    <div className="space-y-6">
      {/* Step Title */}
      <h2 className="text-xl font-semibold text-gray-800">How are you feeling?</h2>

      {/* Instructions */}
      <p className="text-gray-600">
        Briefly describe how you're feeling this morning. What's on your mind? (Optional)
      </p>

      {/* Text Input Area */}
      <div>
        <label htmlFor="feeling-text" className="sr-only">
          Your feelings
        </label>
        <textarea
          id="feeling-text"
          rows={4} // Adjust number of rows as needed
          className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2"
          placeholder="Write a few words..."
          value={feelingText}
          onChange={(e) => setFeelingText(e.target.value)}
        />
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-6">
        <button
          type="button"
          onClick={onBack} // Use the onBack prop directly
          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleNextClick}
          // Next button is always enabled, even if the text area is empty
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Next
        </button>
      </div>
    </div>
  );
}
