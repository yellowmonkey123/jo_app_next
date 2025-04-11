'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import HabitForm from '@/components/habits/HabitForm';
import HabitList from '@/components/habits/HabitList';
import { Habit } from '@/types';
import Link from 'next/link';

export default function HabitsPage() {
  const router = useRouter();
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/signin');
        return;
      }
      
      setIsAuthenticated(true);
      setLoading(false);
    };
    
    checkAuth();
  }, [router]);

  const handleEditHabit = (habit: Habit) => {
    setEditingHabit(habit);
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFormSuccess = () => {
    setEditingHabit(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Manage Habits</h1>
        <Link
          href="/dashboard"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
        >
          Back to Dashboard
        </Link>
      </div>

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">
          {editingHabit ? 'Edit Habit' : 'Add New Habit'}
        </h2>
        <HabitForm 
          onSuccess={handleFormSuccess} 
          initialData={editingHabit || undefined} 
        />
        {editingHabit && (
          <button
            onClick={() => setEditingHabit(null)}
            className="mt-4 text-sm text-gray-500 underline"
          >
            Cancel editing
          </button>
        )}
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <HabitList onEdit={handleEditHabit} />
      </div>
    </div>
  );
}