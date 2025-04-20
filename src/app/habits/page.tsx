'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/supabaseClient';
import HabitForm from '@/components/habits/HabitForm';
import HabitList from '@/components/habits/HabitList';
import { Habit } from '@/types';
import Link from 'next/link';

export default function HabitsPage() {
  const router = useRouter();
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0); // NEW: State to trigger list refresh

  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true); // Ensure loading is true while checking auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/signin');
        // No need to setLoading(false) here as redirect will happen
        return;
      }
      setIsAuthenticated(true);
      setLoading(false);
    };
    checkAuth();
  }, [router]); // Only run on mount and if router changes

  // Function called by HabitList when Edit button is clicked
  const handleEditHabit = (habit: Habit) => {
    setEditingHabit(habit);
    // Scroll to form for better UX
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Function called by HabitForm on successful add/update
  const handleFormSuccess = () => {
    setEditingHabit(null); // Clear editing state
    setRefreshKey(prevKey => prevKey + 1); // NEW: Increment refresh key to trigger list update
  };

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        {/* Improved loading spinner */}
        <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  // Render null if not authenticated (redirect happens in useEffect)
  if (!isAuthenticated) {
    return null;
  }

  // Render the main page content if authenticated
  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Manage Habits</h1>
        <Link
          href="/dashboard"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          &larr; Back to Dashboard
        </Link>
      </div>

      {/* Form Section */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">
          {editingHabit ? 'Edit Habit' : 'Add New Habit'}
        </h2>
        <HabitForm
          // Use a key prop to force re-mount when switching between add/edit
          // This ensures useEffect in HabitForm resets state correctly.
          key={editingHabit ? editingHabit.id : 'new'}
          onSuccess={handleFormSuccess}
          initialData={editingHabit || undefined}
        />
        {/* Show Cancel button only when editing */}
        {editingHabit && (
          <button
            onClick={() => setEditingHabit(null)}
            className="mt-4 text-sm text-gray-600 hover:text-gray-800 underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 rounded"
          >
            Cancel Editing
          </button>
        )}
      </div>

      {/* List Section */}
      <div className="bg-white shadow-md rounded-lg p-6">
        {/* Pass refreshKey to HabitList */}
        <HabitList onEdit={handleEditHabit} refreshKey={refreshKey} />
      </div>
    </div>
  );
}