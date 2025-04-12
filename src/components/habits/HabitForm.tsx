'use client';

import { useState, useEffect } from 'react'; // Import useEffect
import { HabitTiming } from '@/types';
import { supabase } from '@/lib/supabase/client';

interface HabitFormProps {
  onSuccess: () => void;
  initialData?: {
    id: string;
    name: string;
    timing: HabitTiming;
  };
}

export default function HabitForm({ onSuccess, initialData }: HabitFormProps) {
  // Internal state for the form fields
  const [name, setName] = useState('');
  const [timing, setTiming] = useState<HabitTiming>(HabitTiming.ANYTIME);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!initialData;

  // --- NEW: useEffect to update form state when initialData changes ---
  // This ensures the form pre-fills correctly when 'Edit' is clicked
  // or resets when switching from Edit mode back to Add mode.
  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setTiming(initialData.timing);
    } else {
      // Reset form when switching back to 'Add New' mode
      setName('');
      setTiming(HabitTiming.ANYTIME);
    }
  }, [initialData]); // Re-run this effect when initialData prop changes

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!name.trim()) {
      setError('Habit name is required');
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be logged in to manage habits');

      if (isEditing && initialData) { // Ensure initialData exists when editing
        // Update existing habit
        const { error: updateError } = await supabase
          .from('habits')
          .update({ name: name.trim(), timing }) // Trim name on update
          .eq('id', initialData.id)
          .select() // Optionally select to confirm update
          .single(); // Use single() if you expect exactly one row updated

        if (updateError) throw updateError;

      } else {
        // Insert new habit
        const { error: insertError } = await supabase
          .from('habits')
          .insert({
            name: name.trim(), // Trim name on insert
            timing,
            user_id: user.id
          });

        if (insertError) throw insertError;
      }

      // Clear form fields internally (useEffect will handle reset if needed)
      // setName(''); // Let useEffect handle reset based on initialData change
      // setTiming(HabitTiming.ANYTIME);

      // Notify parent component of success (which should trigger list refresh)
      onSuccess();

    } catch (err: any) {
      console.error("Error saving habit:", err); // Log the error
      // Provide more specific error messages if possible
      if (err.message?.includes('unique constraint')) {
         setError('A habit with this name already exists.');
      } else {
         setError(err.message || 'An error occurred while saving the habit');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
           <p className="font-semibold">Error</p>
           <p>{error}</p>
        </div>
      )}

      <div>
        <label htmlFor="habit-name" className="block text-sm font-medium text-gray-700">
          Habit Name
        </label>
        <input
          type="text"
          id="habit-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2"
          placeholder="e.g., Morning meditation"
          required
          disabled={loading} // Disable input while loading
        />
      </div>

      <div>
        <label htmlFor="habit-timing" className="block text-sm font-medium text-gray-700">
          Timing
        </label>
        <select
          id="habit-timing"
          value={timing}
          onChange={(e) => setTiming(e.target.value as HabitTiming)}
          className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 bg-white" // Ensure bg-white for select
          disabled={loading} // Disable input while loading
        >
          {/* Explicitly list options based on HabitTiming enum */}
          <option value={HabitTiming.AM}>Morning (AM)</option>
          <option value={HabitTiming.PM}>Evening (PM)</option>
          <option value={HabitTiming.ANYTIME}>Anytime</option>
        </select>
      </div>

      <div>
        <button
          type="submit"
          disabled={loading}
          className={`inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {loading ? 'Saving...' : isEditing ? 'Update Habit' : 'Add Habit'}
        </button>
      </div>
    </form>
  );
}
