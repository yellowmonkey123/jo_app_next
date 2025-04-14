'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
// import type { User } from '@supabase/supabase-js'; // Assuming User type isn't needed directly here now
import { DailyLog } from '@/types'; // Make sure DailyLog type matches the function's return structure
import Link from 'next/link';

export default function Dashboard() {
  const router = useRouter();
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // Added basic error state for feedback

  useEffect(() => {
    const checkAuthAndFetchLog = async () => {
      setLoading(true);
      setError(null); // Reset error on fetch
      setTodayLog(null); // Reset log state

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        console.error("Session error or no session:", sessionError);
        // No need to set loading false here, redirect will happen
        router.push('/auth/signin');
        return;
      }

      try {
        console.log("Dashboard: Calling get_today_log_for_user for user:", session.user.id);
        // --- MODIFIED: Call the RPC function instead of querying the table ---
        const { data, error: rpcError } = await supabase
            .rpc('get_today_log_for_user', { p_user_id: session.user.id }) // Pass the user ID parameter
            .maybeSingle(); // Expecting one or zero rows matching the DailyLog type

        if (rpcError) {
          // Throw the error to be caught by the catch block
          throw rpcError;
        }

        console.log("Dashboard: RPC call successful, data:", data);
        if (data) {
          // Make sure the structure returned by the function matches DailyLog type
          setTodayLog(data as DailyLog);
        } else {
          setTodayLog(null); // Explicitly set to null if no log found for today
        }
      // --- END MODIFIED ---

      } catch (err: unknown) {
          console.error("Error fetching today's log via RPC:", err);
          // Set an error message for the user
          setError(err instanceof Error ? err.message : "Failed to load today's progress.");
          setTodayLog(null); // Ensure log is null on error
      } finally {
          setLoading(false); // Ensure loading is set to false in all cases (success or error)
      }
    };

    checkAuthAndFetchLog();
  }, [router]); // Dependency array includes router

  // --- Loading State ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
         <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
      </div>
    );
  }

  // --- Main Content Render ---
  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Welcome to Jo</h1>

      {/* --- ADDED: Display error message if fetching failed --- */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-6" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
        </div>
      )}
      {/* --- END ADDED --- */}


      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Today&apos;s Progress</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Morning Startup section (Logic remains the same, depends on todayLog state) */}
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

          {/* Evening Shutdown section (Logic remains the same, depends on todayLog state) */}
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

      {/* Bottom links section (Unchanged) */}
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