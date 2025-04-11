'use client';

import { useState } from 'react';
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
  const [name, setName] = useState(initialData?.name || '');
  const [timing, setTiming] = useState<HabitTiming>(initialData?.timing || HabitTiming.ANYTIME);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isEditing = !!initialData;

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
      // Get the current user's ID
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('You must be logged in to manage habits');
      
      if (isEditing) {
        // Update existing habit
        const { error: updateError } = await supabase
          .from('habits')
          .update({ name, timing })
          .eq('id', initialData.id);
          
        if (updateError) throw updateError;
      } else {
        // Insert new habit
        const { error: insertError } = await supabase
          .from('habits')
          .insert({ 
            name, 
            timing,
            user_id: user.id 
          });
          
        if (insertError) throw insertError;
      }
      
      // Clear form and notify parent
      setName('');
      setTiming(HabitTiming.ANYTIME);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving the habit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <p className="text-red-700">{error}</p>
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
          className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2"
        >
          <option value={HabitTiming.AM}>Morning (AM)</option>
          <option value={HabitTiming.PM}>Evening (PM)</option>
          <option value={HabitTiming.ANYTIME}>Anytime</option>
        </select>
      </div>
      
      <div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          {loading ? 'Saving...' : isEditing ? 'Update Habit' : 'Add Habit'}
        </button>
      </div>
    </form>
  );
}