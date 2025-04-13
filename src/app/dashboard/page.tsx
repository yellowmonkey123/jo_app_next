'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
// Import User type from Supabase if needed for other parts, but not strictly needed for this fix
// import type { User } from '@supabase/supabase-js';
import { DailyLog } from '@/types';
import Link from 'next/link';

export default function Dashboard() {
  const router = useRouter();
  // Removed unused 'user' state: const [user, setUser] = useState<User | null>(null);
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession(); // Also capture session error just in case
      
      // Handle potential session error
      if (sessionError || !session) {
        console.error("Session error or no session:", sessionError);
        router.push('/auth/signin');
        return;
      }
      
      // No longer need to set user state: setUser(session.user);
      
      // Fetch today's log if it exists
      const today = new Date().toISOString().split('T')[0];
      // Prefix unused 'error' with underscore
      const { data, error: _error } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', session.user.id) // Use session directly
        .eq('log_date', today)
        .maybeSingle(); // Use maybeSingle() to gracefully handle no row found

      // Log Supabase query error if it occurs (optional but good practice)
      if (_error) {
          console.error("Error fetching today's log:", _error);
      }
      
      if (data) {
        setTodayLog(data as DailyLog);
      } else {
        setTodayLog(null); // Ensure state is null if no data
      }
      
      setLoading(false);
    };
    
    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // Rest of the component remains the same...
  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Welcome to Jo</h1>
      
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Today's Progress</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Morning Startup</h3>
            {todayLog?.startup_completed_at ? (
              <div className="text-green-600 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Completed
              </div>
            ) : (
              <Link 
                href="/startup" 
                className="inline-block bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition"
              >
                Begin Startup
              </Link>
            )}
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Evening Shutdown</h3>
            {todayLog?.shutdown_completed_at ? (
              <div className="text-green-600 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Completed
              </div>
            ) : todayLog?.startup_completed_at ? (
              <Link 
                href="/shutdown" 
                className="inline-block bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition"
              >
                Begin Shutdown
              </Link>
            ) : (
              <span className="text-gray-500">
                Complete startup first
              </span>
            )}
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/habits" className="bg-white shadow rounded-lg p-6 hover:shadow-md transition">
          <h2 className="text-xl font-semibold mb-2">Manage Habits</h2>
          <p className="text-gray-600">Create, edit and organize your daily habits</p>
        </Link>
        
        <Link href="/weekly-report" className="bg-white shadow rounded-lg p-6 hover:shadow-md transition">
          <h2 className="text-xl font-semibold mb-2">Weekly Report</h2>
          <p className="text-gray-600">Review your progress and insights</p>
        </Link>
      </div>
    </div>
  );
}