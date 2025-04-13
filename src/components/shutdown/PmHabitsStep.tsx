'use client';

import { useState, useEffect, ChangeEvent } from 'react'; // Import ChangeEvent
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
  const [availableHabits, setAvailableHabits] = useState<Habit[]>([]);
  const [selectedHabitIds, setSelectedHabitIds] = useState<Set<string>>(new Set(initialValue));
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

        const { data, error: fetchError } = await supabase
          .from('habits')
          .select('*')
          .eq('user_id', user.id)
          .in('timing', [HabitTiming.PM, HabitTiming.ANYTIME])
          .order('name', { ascending: true });

        if (fetchError) throw fetchError;

        setAvailableHabits(data as Habit[]);
      // --- FIXED: Changed 'any' to 'unknown' and added type check ---
      } catch (err: unknown) {
        console.error("Error fetching PM/Anytime habits:", err);
        // Set error message, checking if err is an Error instance
        setError(err instanceof Error ? err.message : "Failed to load evening/anytime habits.");
      } finally {
        setLoading(false);
      }
    };

    fetchPmHabits();
  }, []);

  // Update internal state if the initialValue prop changes
  useEffect(() => {
    setSelectedHabitIds(new Set(initialValue));
  }, [initialValue]);


  // Handle checkbox changes
  const handleCheckboxChange = (habitId: string, isChecked: boolean) => {
    setSelectedHabitIds(prevIds => {
      const newIds = new Set(prevIds);
      if (isChecked) {
        newIds.add(habitId);
      } else {
        newIds.delete(habitId);
      }
      return newIds;
    });
  };

  // Handle clicking the 'Complete Shutdown' button
  const handleCompleteClick = () => {
    const completedHabitsArray = Array.from(selectedHabitIds);
    onNext({ completed_pm_anytime_habits: completedHabitsArray });
  };

  return (
    <div className="space-y-6">
      {/* Step Title */}
      <h2 className="text-xl font-semibold text-gray-800">Completed PM & Anytime Habits</h2>

      {/* Instructions */}
      <p className="text-gray-600">
        Check off the evening or anytime habits you&apos;ve completed today. {/* Fixed unescaped quote */}
      </p>

      {/* Habits List Area */}
      <div className="space-y-3 max-h-60 overflow-y-auto border border-gray-200 rounded-md p-4">
        {loading && <p className="text-gray-500">Loading habits...</p>}
        {error && <p className="text-red-600">Error: {error}</p>}

        {!loading && !error && availableHabits.length === 0 && (
          // --- FIXED: Replaced ' with &apos; ---
          <p className="text-gray-500">No relevant PM or Anytime habits found. You can add habits in the &apos;Manage Habits&apos; section.</p>
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
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleCheckboxChange(habit.id, e.target.checked)} // Added ChangeEvent
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </div>
              <div className="ml-3 text-sm leading-6">
                <label htmlFor={`habit-${habit.id}`} className="font-medium text-gray-900">
                  {habit.name}
                </label>
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
          onClick={onBack}
          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleCompleteClick}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          Complete Shutdown
        </button>
      </div>
    </div>
  );
}