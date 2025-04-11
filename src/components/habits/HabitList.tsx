'use client';

import { useEffect, useState } from 'react';
import { Habit, HabitTiming } from '@/types';
import { supabase } from '@/lib/supabase/client';

interface HabitListProps {
  onEdit: (habit: Habit) => void;
}

export default function HabitList({ onEdit }: HabitListProps) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch habits on component mount
  useEffect(() => {
    fetchHabits();
  }, []);

  const fetchHabits = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('habits')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      setHabits(data as Habit[]);
    } catch (err: any) {
      setError(err.message || 'Failed to load habits');
      console.error('Error fetching habits:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const deleteHabit = async (id: string) => {
    if (!confirm('Are you sure you want to delete this habit?')) return;
    
    try {
      setError(null);
      
      const { error } = await supabase
        .from('habits')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      // Refresh habits list
      fetchHabits();
    } catch (err: any) {
      setError(err.message || 'Failed to delete habit');
      console.error('Error deleting habit:', err);
    }
  };
  
  const getTimingLabel = (timing: HabitTiming) => {
    switch (timing) {
      case HabitTiming.AM:
        return 'Morning';
      case HabitTiming.PM:
        return 'Evening';
      case HabitTiming.ANYTIME:
        return 'Anytime';
      default:
        return timing;
    }
  };
  
  const getTimingColor = (timing: HabitTiming) => {
    switch (timing) {
      case HabitTiming.AM:
        return 'bg-yellow-100 text-yellow-800';
      case HabitTiming.PM:
        return 'bg-blue-100 text-blue-800';
      case HabitTiming.ANYTIME:
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div className="py-4 text-gray-500">Loading habits...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-4 my-4">
        <p className="text-red-700">{error}</p>
        <button
          onClick={fetchHabits}
          className="mt-2 text-sm text-red-700 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (habits.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-lg">
        <p className="text-gray-500">You haven't created any habits yet.</p>
        <p className="text-gray-500">Add your first habit using the form above!</p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Your Habits</h3>
      <ul className="divide-y divide-gray-200 border-t border-b border-gray-200">
        {habits.map((habit) => (
          <li key={habit.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">{habit.name}</p>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTimingColor(habit.timing)}`}>
                {getTimingLabel(habit.timing)}
              </span>
            </div>
            <div className="mt-2 sm:mt-0 space-x-2">
              <button
                onClick={() => onEdit(habit)}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
              >
                Edit
              </button>
              <button
                onClick={() => deleteHabit(habit.id)}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-50 hover:bg-red-100"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}