// src/app/dashboard/page.tsx
import { redirect } from 'next/navigation';
import Link from 'next/link';
// Assuming DailyLog type is correctly defined
import type { DailyLog } from '@/types';
// Import the server-side Supabase client function
import { getServerSupabase } from '@/lib/supabase/serverClient';

// --- Helper Functions (defined outside component for clarity) ---

/**
 * Fetches the current user session using the server-side Supabase client.
 * Encapsulates the client creation.
 * @returns {Promise<{data: {session: import('@supabase/supabase-js').Session | null}, error: import('@supabase/supabase-js').AuthError | null}>} Session data and error object.
 * @throws Error if Supabase client fails to initialize.
 */
async function getSessionData() {
  // Create client *inside* the async function
  const supabase = getServerSupabase();
  // Add null check for robustness, although usually safe in Server Component context if env vars are set
  if (!supabase) {
      console.error("Dashboard Helper (getSessionData): Failed to initialize Supabase client.");
      throw new Error("Database connection failed.");
  }
  // Fetch session
  const { data, error } = await supabase.auth.getSession();
  // Return both data and error for handling in the component
  return { data, error };
}

/**
 * Fetches today's daily log for a given user using an RPC call.
 * Encapsulates the client creation.
 * @param userId The ID of the user whose log to fetch.
 * @returns {Promise<{data: DailyLog | null, error: import('@supabase/supabase-js').PostgrestError | null}>} Log data and error object.
 * @throws Error if Supabase client fails to initialize or if invalid data is received.
 */
async function getLogData(userId: string): Promise<{data: DailyLog | null, error: import('@supabase/supabase-js').PostgrestError | null}> {
   // Create client *inside* the async function
   const supabase = getServerSupabase();
   if (!supabase) {
       console.error("Dashboard Helper (getLogData): Failed to initialize Supabase client.");
       throw new Error("Database connection failed.");
   }
   // Perform the RPC call
   // Note: Ensure the 'get_today_log_for_user' function exists and works correctly in your database.
   const { data: todayLogData, error } = await supabase
    .rpc('get_today_log_for_user', { p_user_id: userId }) // Pass user ID to RPC
    .maybeSingle(); // Expect 0 or 1 row

   // Handle potential RPC errors during fetch
   if (error) {
       console.error("Dashboard Helper (getLogData): Error fetching today's log via RPC:", error);
       // Return error to be handled by the component
       return { data: null, error };
   }

   // Basic validation in case RPC returns unexpected non-object data (though maybeSingle helps)
   if (todayLogData && typeof todayLogData !== 'object') {
       console.error("Dashboard Helper (getLogData): Invalid log data received from RPC:", todayLogData);
       // Throw an error or handle appropriately
       throw new Error('Invalid log data received from database function.');
   }

   // Return data (casted) and null error
   return { data: todayLogData as DailyLog | null, error: null };
}

// --- Async Server Component ---

export default async function DashboardPage() {
  console.log("DashboardPage: Rendering component...");

  let session = null;
  let sessionError = null;
  let log: DailyLog | null = null;
  let rpcError = null;

  try {
      // Call the helper function to get session data
      const sessionResult = await getSessionData();
      session = sessionResult.data.session;
      sessionError = sessionResult.error;

      // Redirect if no session or error fetching session
      if (sessionError || !session) {
        console.error("Dashboard: No session found or error fetching session. Redirecting.", sessionError);
        return redirect('/auth/signin');
      }
      console.log("Dashboard: Session found for user:", session.user.id);

      // Fetch log data using the session user ID via the helper function
      const logResult = await getLogData(session.user.id);
      log = logResult.data;
      rpcError = logResult.error; // Assign RPC error if one occurred

      console.log("Dashboard: Log data fetched:", log ? `Log ID ${log.id}` : "No log found", "RPC Error:", rpcError);

  } catch (error) {
      // Catch errors from helper functions (e.g., client init failure)
      console.error("Dashboard: Critical error during data fetching:", error);
      // Render an error state or redirect
      // For simplicity, showing a generic error message here
      return (
           <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
              <h1 className="text-3xl font-bold mb-6">Welcome to Jo</h1>
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6" role="alert">
                  <strong className="font-bold">Error:</strong>
                  <span className="ml-2">{error instanceof Error ? error.message : "Failed to load dashboard data."}</span>
              </div>
           </div>
      );
  }


  // --- Render Logic (using fetched data) ---
  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl font-bold mb-6">Welcome to Jo</h1>

      {/* Display RPC Error if it occurred during log fetch */}
      {rpcError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6" role="alert">
          <strong className="font-bold">Error:</strong>
          {/* Provide a user-friendly message */}
          <span className="ml-2">{rpcError.message || "Failed to load today's progress."}</span>
        </div>
      )}

      {/* Today's Progress Section */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Today&apos;s Progress</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Morning Startup Card */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="font-medium mb-2 text-gray-800">Morning Startup</h3>
            {log?.startup_completed_at ? (
              // Display completed status
              <div className="text-green-600 flex items-center text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Completed
              </div>
            ) : (
              // Display link to start
              <Link
                href="/startup"
                className="inline-block bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 text-sm font-medium transition-colors"
              >
                Begin Startup
              </Link>
            )}
          </div>

          {/* Evening Shutdown Card */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="font-medium mb-2 text-gray-800">Evening Shutdown</h3>
            {log?.shutdown_completed_at ? (
              // Display completed status
              <div className="text-green-600 flex items-center text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Completed
              </div>
            ) : log?.startup_completed_at ? (
              // Display link to start (only if startup is done)
              <Link
                href="/shutdown"
                className="inline-block bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 text-sm font-medium transition-colors"
              >
                Begin Shutdown
              </Link>
            ) : (
              // Display message if startup isn't done
              <span className="text-gray-500 text-sm italic">Complete startup first</span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Links Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Manage Habits Link */}
        <Link
          href="/habits"
          className="block bg-white shadow rounded-lg p-6 hover:shadow-lg hover:border-indigo-100 border border-transparent transition duration-150 ease-in-out"
        >
          <h2 className="text-xl font-semibold mb-2 text-gray-800">Manage Habits</h2>
          <p className="text-gray-600 text-sm">Create, edit, and organize your daily habits.</p>
        </Link>

        {/* Weekly Report Link */}
        <Link
          href="/weekly-report"
          className="block bg-white shadow rounded-lg p-6 hover:shadow-lg hover:border-indigo-100 border border-transparent transition duration-150 ease-in-out"
        >
          <h2 className="text-xl font-semibold mb-2 text-gray-800">Weekly Report</h2>
          <p className="text-gray-600 text-sm">Review your progress and insights from the past week.</p>
        </Link>
      </div>
    </div>
  );
}