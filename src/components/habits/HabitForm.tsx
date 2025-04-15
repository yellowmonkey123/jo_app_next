'use client';

import { useState, useEffect, FormEvent } from 'react';
// --- CORRECTED IMPORT: Removed unused 'Habit' type ---
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

  const handleSubmit = async (e: FormEvent) => { // Start of handleSubmit
    e.preventDefault();
    setLoading(true);
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Habit name is required');
      setLoading(false);
      return;
    } // End of if(!trimmedName)

    try { // Start try block
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError; // Check userError
      if (!user) throw new Error('You must be logged in to manage habits');

      if (isEditing && initialData) { // Start if(isEditing)
        // --- UPDATE Logic ---
        const { error: updateError } = await supabase
          .from('habits')
          .update({ name: trimmedName, timing }) 
          .eq('id', initialData.id);
        if (updateError) throw updateError; // Check updateError
      } else { // Start else block (for insert)
        // --- INSERT Logic (Includes sort_order) ---
        const { data: maxOrderData, error: maxOrderError } = await supabase
          .from('habits')
          .select('sort_order')
          .eq('user_id', user.id)
          .eq('timing', timing)
          .order('sort_order', { ascending: false }) 
          .limit(1) 
          .maybeSingle(); 

        if (maxOrderError) {
            console.error("Error fetching max sort order:", maxOrderError);
        }

        const maxSortOrder = maxOrderData?.sort_order ?? -1; 
        const newSortOrder = maxSortOrder + 1;
        
        const { error: insertError } = await supabase
          .from('habits')
          .insert({
            name: trimmedName,
            timing: timing,
            user_id: user.id,
            sort_order: newSortOrder, 
          });

        if (insertError) throw insertError; // Check insertError
      } // End else block

      onSuccess(); // Call the success callback

    } catch (err: unknown) { // Start catch block
      console.error("Error saving habit:", err);
      if (err instanceof Error) {
        if (err.message?.includes('duplicate key value violates unique constraint')) {
           setError('A habit with this name and timing already exists.');
        } else {
           setError(err.message || 'An error occurred while saving the habit');
        }
      } else {
        setError('An unexpected error occurred while saving the habit');
      }
    } finally { // Start finally block
      setLoading(false);
    } // End finally block
  
  }; // <<< --- Ensure this closing brace and semicolon for handleSubmit are present ---

  // --- Render the form ---
  return ( // Start return
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && ( 
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert"> 
              <p className="font-semibold">Error</p> <p>{error}</p> 
          </div> 
      )}
      <div>
        <label htmlFor="habit-name" className="block text-sm font-medium text-gray-700"> Habit Name </label>
        <input type="text" id="habit-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2" placeholder="e.g., Morning meditation" required disabled={loading} />
      </div>
      <div>
        <label htmlFor="habit-timing" className="block text-sm font-medium text-gray-700"> Timing </label>
        <select id="habit-timing" value={timing} onChange={(e) => setTiming(e.target.value as HabitTiming)} className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 bg-white" disabled={loading}>
          {/* Assuming HabitTiming is an enum or similar */}
          {Object.values(HabitTiming).map(timingValue => (
            <option key={timingValue} value={timingValue}>
              {timingValue === HabitTiming.AM ? 'Morning (AM)' : timingValue === HabitTiming.PM ? 'Evening (PM)' : 'Anytime'}
            </option>
          ))}
        </select>
      </div>
      <div>
        <button type="submit" disabled={loading} className={`inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}> {loading ? 'Saving...' : isEditing ? 'Update Habit' : 'Add Habit'} </button>
      </div>
    </form>
  ); // End return
} // End HabitForm component function
