'use client';

import { useState, useEffect } from 'react';
import { ShutdownFormData } from '@/app/shutdown/page'; // Adjust path if needed

// Define the props the component expects
interface ImprovementStepProps {
  initialValue: string; // The current value from the main form data
  onNext: (data: Partial<ShutdownFormData>) => void; // Callback to proceed to next step
  onBack: () => void; // Callback to go back
}

export default function ImprovementStep({ initialValue, onNext, onBack }: ImprovementStepProps) {
  // State to hold the user's text input within this step
  const [improvementText, setImprovementText] = useState<string>(initialValue);

  // Update internal state if the initialValue prop changes (e.g., user navigates back)
  useEffect(() => {
    setImprovementText(initialValue);
  }, [initialValue]);

  // Handle clicking the 'Next' button
  const handleNextClick = () => {
    // No validation needed as input is optional
    // Call the onNext prop passed from the parent page,
    // providing the data for this step (improvement).
    onNext({ improvement: improvementText.trim() });
  };

  return (
    <div className="space-y-6">
      {/* Step Title */}
      <h2 className="text-xl font-semibold text-gray-800">Area for Improvement</h2>

      {/* Instructions */}
      <p className="text-gray-600">
        What's one thing you could improve upon or approach differently tomorrow? (Optional)
      </p>

      {/* Text Input Area */}
      <div>
        <label htmlFor="improvement-text" className="sr-only">
          Area for improvement
        </label>
        <textarea
          id="improvement-text"
          rows={4} // Adjust number of rows as needed
          className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2"
          placeholder="e.g., Start work earlier, take more breaks, plan meals..."
          value={improvementText}
          onChange={(e) => setImprovementText(e.target.value)}
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
          // Next button is always enabled as input is optional
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Next
        </button>
      </div>
    </div>
  );
}