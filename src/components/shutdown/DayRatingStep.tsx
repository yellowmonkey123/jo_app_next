'use client';

import { useState, useEffect } from 'react';
import { Rating } from '@/types'; // Assuming Rating is 1 | 2 | 3 | 4 | 5
import { ShutdownFormData } from '@/types'; // Adjust path if needed

// Define the props the component expects
interface DayRatingStepProps {
  initialValue: Rating | null; // The current value from the main form data
  onNext: (data: Partial<ShutdownFormData>) => void; // Callback to proceed to next step
  onBack: () => void; // Callback to go back
}

export default function DayRatingStep({ initialValue, onNext, onBack }: DayRatingStepProps) {
  // State to hold the user's selection within this step
  const [selectedRating, setSelectedRating] = useState<Rating | null>(initialValue);

  // Update internal state if the initialValue prop changes (e.g., user navigates back)
  useEffect(() => {
    setSelectedRating(initialValue);
  }, [initialValue]);

  // Handle clicking a rating button
  const handleRatingSelect = (rating: Rating) => {
    setSelectedRating(rating);
  };

  // Handle clicking the 'Next' button
  const handleNextClick = () => {
    if (selectedRating !== null) {
      // Call the onNext prop passed from the parent page,
      // providing the data for this step (day_rating).
      onNext({ day_rating: selectedRating });
    }
  };

  const ratingOptions: Rating[] = [1, 2, 3, 4, 5];

  return (
    <div className="space-y-6">
      {/* Step Title */}
      <h2 className="text-xl font-semibold text-gray-800">Day Rating</h2>

      {/* Instructions */}
      <p className="text-gray-600">
        How would you rate your day overall, considering productivity, mood, and well-being?
      </p>

      {/* Rating Input - Buttons */}
      <div className="flex justify-center space-x-2 sm:space-x-4 pt-4">
        {ratingOptions.map((rating) => (
          <button
            key={rating}
            type="button"
            onClick={() => handleRatingSelect(rating)}
            className={`flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full border text-sm sm:text-lg font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
              selectedRating === rating
                ? 'bg-indigo-600 text-white border-indigo-600' // Selected style
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50' // Default style
            }`}
          >
            {rating}
          </button>
        ))}
      </div>
       {/* Optional: Add labels below buttons (e.g., 1=Poor, 5=Excellent) */}
       <div className="flex justify-between text-xs text-gray-500 px-2 sm:px-4">
         <span>Poor</span>
         <span>Average</span>
         <span>Excellent</span>
      </div>


      {/* Navigation Buttons */}
      <div className="flex justify-between pt-6">
        <button
          type="button"
          onClick={onBack} // Use the onBack prop directly
          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Back to Dashboard {/* Changed label as it's the first step */}
        </button>
        <button
          type="button"
          onClick={handleNextClick}
          disabled={selectedRating === null} // Disable Next until a rating is selected
          className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
            selectedRating === null
              ? 'bg-indigo-300 cursor-not-allowed' // Disabled style
              : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500' // Enabled style
          }`}
        >
          Next
        </button>
      </div>
    </div>
  );
}
