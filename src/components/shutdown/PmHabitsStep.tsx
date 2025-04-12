'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Habit, HabitTiming } from '@/types'; // Assuming Habit type is defined
import { ShutdownFormData } from '@/app/shutdown/page'; // Adjust path if needed

// Define the props the component expects
interface PmHabitsStepProps {
  initialValue: string[]; // Array of initially completed habit IDs
  onNext: (data: Partial<ShutdownFormData>) => void; // Callback for final submission trigger
  onBack: () => void; // Callback to go back
}

export default function PmHabitsStep({ initialValue, onNext, onBack }: PmHabitsStepProps) {
  // State for fetched habits relevant to this step
  const [availableHabits, setAvailableHabits] = useState<Habit[]>([]);
  // State to track which habit IDs are selected (using a Set for efficiency)
  const [selectedHabitIds, setSelectedHabitIds] = useState<Set<string>>(new Set(initialValue));
  // Loading and error states for fetching habits
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch relevant habits when the component mounts
  useEffect(() => {
    const fetchPmHabits = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not found");

        // Fetch habits where timing is 'PM' or 'ANYTIME' for the current user
        const { data, error: fetchError } = await supabase
          .from('habits')
          .select('*')
          .eq('user_id', user.id)
          .in('timing', [HabitTiming.PM, HabitTiming.ANYTIME]) // Filter by timing
          .order('name', { ascending: true }); // Order alphabetically

        if (fetchError) throw fetchError;

        setAvailableHabits(data as Habit[]);
      } catch (err: any) {
        console.error("Error fetching PM/Anytime habits:", err);
        setError(err.message || "Failed to load evening/anytime habits.");
      } finally {
        setLoading(false);
      }
    };

    fetchPmHabits();
  }, []); // Fetch only once on mount

  // Update internal state if the initialValue prop changes (e.g., user navigates back)
  useEffect(() => {
    setSelectedHabitIds(new Set(initialValue));
  }, [initialValue]);


  // Handle checkbox changes
  const handleCheckboxChange = (habitId: string, isChecked: boolean) => {
    setSelectedHabitIds(prevIds => {
      const newIds = new Set(prevIds); // Create a new Set from the previous state
      if (isChecked) {
        newIds.add(habitId); // Add ID if checked
      } else {
        newIds.delete(habitId); // Remove ID if unchecked
      }
      return newIds; // Return the new Set
    });
  };

  // Handle clicking the 'Complete Shutdown' button
  const handleCompleteClick = () => {
    // Convert the Set of selected IDs back to an array
    const completedHabitsArray = Array.from(selectedHabitIds);
    // Call the onNext prop, providing the data for this step
    onNext({ completed_pm_anytime_habits: completedHabitsArray });
  };

  return (
    <div className="space-y-6">
      {/* Step Title */}
      <h2 className="text-xl font-semibold text-gray-800">Completed PM & Anytime Habits</h2>

      {/* Instructions */}
      <p className="text-gray-600">
        Check off the evening or anytime habits you've completed today.
      </p>

      {/* Habits List Area */}
      <div className="space-y-3 max-h-60 overflow-y-auto border border-gray-200 rounded-md p-4">
        {loading && <p className="text-gray-500">Loading habits...</p>}
        {error && <p className="text-red-600">Error: {error}</p>}

        {!loading && !error && availableHabits.length === 0 && (
          <p className="text-gray-500">No relevant PM or Anytime habits found. You can add habits in the 'Manage Habits' section.</p>
        )}

        {!loading && !error && availableHabits.length > 0 && (
          availableHabits.map((habit) => (
            <div key={habit.id} className="relative flex items-start">
              <div className="flex h-6 items-center">
                <input
                  id={`habit-${habit.id}`}
                  aria-describedby={`habit-description-${habit.id}`}
                  name="pm_anytime_habits"
                  type="checkbox"
                  checked={selectedHabitIds.has(habit.id)}
                  onChange={(e) => handleCheckboxChange(habit.id, e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </div>
              <div className="ml-3 text-sm leading-6">
                <label htmlFor={`habit-${habit.id}`} className="font-medium text-gray-900">
                  {habit.name}
                </label>
                 {/* Optional: Add timing indicator for clarity */}
                 <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${habit.timing === HabitTiming.PM ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                    {habit.timing}
                 </span>
              </div>
            </div>
          ))
        )}
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
          onClick={handleCompleteClick}
          // The final button triggers the submission process via onNext
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          Complete Shutdown
        </button>
      </div>
    </div>
  );
}
