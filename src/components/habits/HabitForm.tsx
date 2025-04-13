'use client';

import { useState, useEffect, FormEvent } from 'react'; // Import FormEvent
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
  const [name, setName] = useState('');
  const [timing, setTiming] = useState<HabitTiming>(HabitTiming.ANYTIME);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!initialData;

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setTiming(initialData.timing);
    } else {
      setName('');
      setTiming(HabitTiming.ANYTIME);
    }
  }, [initialData]);

  const handleSubmit = async (e: FormEvent) => { // Use FormEvent type
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

      if (isEditing && initialData) {
        const { error: updateError } = await supabase
          .from('habits')
          .update({ name: name.trim(), timing })
          .eq('id', initialData.id)
          .select()
          .single();
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('habits')
          .insert({
            name: name.trim(),
            timing,
            user_id: user.id
          });
        if (insertError) throw insertError;
      }

      onSuccess();

    // --- FIXED: Changed 'any' to 'unknown' and added type check ---
    } catch (err: unknown) {
      console.error("Error saving habit:", err);
      // Check if error is an instance of Error before accessing message
      if (err instanceof Error) {
        if (err.message?.includes('unique constraint')) {
           setError('A habit with this name and timing already exists.'); // Updated message slightly
        } else {
           setError(err.message || 'An error occurred while saving the habit');
        }
      } else {
        // Handle cases where the caught item isn't a standard Error
        setError('An unexpected error occurred while saving the habit');
      }
    } finally {
      setLoading(false);
    }
  };

  // --- Render the form (JSX remains the same) ---
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && ( <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert"> <p className="font-semibold">Error</p> <p>{error}</p> </div> )}
      <div>
        <label htmlFor="habit-name" className="block text-sm font-medium text-gray-700"> Habit Name </label>
        <input type="text" id="habit-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2" placeholder="e.g., Morning meditation" required disabled={loading} />
      </div>
      <div>
        <label htmlFor="habit-timing" className="block text-sm font-medium text-gray-700"> Timing </label>
        <select id="habit-timing" value={timing} onChange={(e) => setTiming(e.target.value as HabitTiming)} className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 bg-white" disabled={loading}>
          <option value={HabitTiming.AM}>Morning (AM)</option>
          <option value={HabitTiming.PM}>Evening (PM)</option>
          <option value={HabitTiming.ANYTIME}>Anytime</option>
        </select>
      </div>
      <div>
        <button type="submit" disabled={loading} className={`inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}> {loading ? 'Saving...' : isEditing ? 'Update Habit' : 'Add Habit'} </button>
      </div>
    </form>
  );
}