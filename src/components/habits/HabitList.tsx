'use client';

import { useEffect, useState } from 'react';
import { Habit, HabitTiming } from '@/types';
import { supabase } from '@/lib/supabase/client';

interface HabitListProps {
  onEdit: (habit: Habit) => void;
  refreshKey: number; // Prop to trigger refresh
}

// Define the desired sort order for timings
const timingSortOrder: { [key in HabitTiming]: number } = {
  [HabitTiming.AM]: 1,
  [HabitTiming.ANYTIME]: 2,
  [HabitTiming.PM]: 3,
};

export default function HabitList({ onEdit, refreshKey }: HabitListProps) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // useEffect dependency array includes refreshKey
  useEffect(() => {
    fetchHabits();
  }, [refreshKey]); // Re-run effect when refreshKey changes

  // Function to fetch habits from Supabase
  const fetchHabits = async () => {
    try {
      setLoading(true);
      setError(null); // Clear previous errors on new fetch

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn("HabitList: No user logged in.");
        setHabits([]);
        setLoading(false); // Ensure loading stops if no user
        return;
      }

      // Fetch habits for the current user, order by name ascending in DB
      // This provides the secondary sort order directly from the query
      const { data, error: fetchError } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true }); // <-- MODIFIED: Order by name initially

      if (fetchError) throw fetchError;

      // --- NEW: Custom Sort Logic ---
      const sortedData = (data as Habit[]).sort((a, b) => {
        const timingOrderA = timingSortOrder[a.timing] ?? 99; // Assign high number if timing is unknown
        const timingOrderB = timingSortOrder[b.timing] ?? 99;

        // Compare based on timing first
        if (timingOrderA !== timingOrderB) {
          return timingOrderA - timingOrderB; // Sort by AM -> Anytime -> PM
        }

        // If timings are the same, sort by name (already sorted by DB, but good fallback)
        return a.name.localeCompare(b.name);
      });
      // --- End Custom Sort Logic ---

      setHabits(sortedData); // Set the custom-sorted data

    } catch (err: any) {
      setError(err.message || 'Failed to load habits');
      console.error('Error fetching habits:', err);
    } finally {
      setLoading(false);
    }
  };

  // Function to delete a habit (no changes needed here)
  const deleteHabit = async (id: string) => {
    if (!confirm('Are you sure you want to delete this habit? This action cannot be undone.')) return;
    try {
      setError(null);
      const { error: deleteError } = await supabase
        .from('habits')
        .delete()
        .eq('id', id);
      if (deleteError) throw deleteError;
      fetchHabits(); // Re-fetch to update the list correctly sorted
    } catch (err: any) {
      setError(err.message || 'Failed to delete habit');
      console.error('Error deleting habit:', err);
    }
  };

 // Helper functions for display (no changes needed)
  const getTimingLabel = (timing: HabitTiming) => {
     switch (timing) {
       case HabitTiming.AM: return 'Morning';
       case HabitTiming.PM: return 'Evening';
       case HabitTiming.ANYTIME: return 'Anytime';
       default: return timing;
     }
   };
  const getTimingColor = (timing: HabitTiming) => {
     switch (timing) {
       case HabitTiming.AM: return 'bg-yellow-100 text-yellow-800';
       case HabitTiming.PM: return 'bg-blue-100 text-blue-800';
       case HabitTiming.ANYTIME: return 'bg-green-100 text-green-800';
       default: return 'bg-gray-100 text-gray-800';
     }
   };


  // --- Rendering Logic (No changes needed below this line) ---

  // Render loading state
  if (loading) {
    return <div className="py-4 text-center text-gray-500">Loading habits...</div>;
  }

  // Render error state
  if (error) {
    return (
      <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 my-4 rounded-md" role="alert">
        <p className="font-semibold">Error Loading Habits</p>
        <p>{error}</p>
        <button
          onClick={fetchHabits} // Allow user to retry fetching
          className="mt-2 text-sm font-medium text-red-600 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  // Render empty state
  if (habits.length === 0) {
    return (
      <div className="text-center py-10 px-6 bg-gray-50 rounded-lg">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
           <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="mt-2 text-sm font-semibold text-gray-900">No habits created</h3>
        <p className="mt-1 text-sm text-gray-500">Get started by adding a new habit using the form above.</p>
      </div>
    );
  }

  // Render the list of habits
  return (
    <div className="mt-6">
      <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Your Habits</h3>
      <div className="flow-root"> {/* Use flow-root to contain margins */}
        <ul role="list" className="-my-5 divide-y divide-gray-200 border-t border-b border-gray-200">
          {habits.map((habit) => (
            <li key={habit.id} className="py-4">
              <div className="flex items-center space-x-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{habit.name}</p>
                  <p className="text-sm text-gray-500">
                     <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTimingColor(habit.timing)}`}>
                       {getTimingLabel(habit.timing)}
                     </span>
                  </p>
                </div>
                <div className="inline-flex items-center space-x-2">
                   <button
                    onClick={() => onEdit(habit)}
                    type="button"
                    className="inline-flex items-center px-2.5 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteHabit(habit.id)}
                    type="button"
                    className="inline-flex items-center px-2.5 py-1 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}