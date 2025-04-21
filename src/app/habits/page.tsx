'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import HabitForm from '@/components/habits/HabitForm';
import HabitList from '@/components/habits/HabitList';
import { Habit } from '@/types';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabase/supabaseClient'; // Added import

export default function HabitsPage() {
  const router = useRouter();
  const supabase = getSupabaseClient(); // Initialize Supabase client
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);
      if (!supabase) {
        console.error('Supabase client not initialized. Check environment configuration.');
        router.push('/auth/signin');
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/signin');
        return;
      }
      setIsAuthenticated(true);
      setLoading(false);
    };
    checkAuth();
  }, [router, supabase]); // Added supabase to dependencies

  const handleEditHabit = (habit: Habit) => {
    setEditingHabit(habit);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFormSuccess = () => {
    setEditingHabit(null);
    setRefreshKey(prevKey => prevKey + 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Manage Habits</h1>
        <Link
          href="/dashboard"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          ← Back to Dashboard
        </Link>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">
          {editingHabit ? 'Edit Habit' : 'Add New Habit'}
        </h2>
        <HabitForm
          key={editingHabit ? editingHabit.id : 'new'}
          onSuccess={handleFormSuccess}
          initialData={editingHabit || undefined}
        />
        {editingHabit && (
          <button
            onClick={() => setEditingHabit(null)}
            className="mt-4 text-sm text-gray-600 hover:text-gray-800 underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 rounded"
          >
            Cancel Editing
          </button>
        )}
      </div>

      <div className="bg-white shadow-md rounded-lg p-6">
        <HabitList onEdit={handleEditHabit} refreshKey={refreshKey} />
      </div>
    </div>
  );
}