'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { startOfWeek, subDays, format } from 'date-fns';
// Import Supabase client function
import { getSupabaseClient } from '@/lib/supabase/supabaseClient';
// Import Recharts components
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// Define the expected structure of the data returned by the Supabase RPC function
// Ensure this matches the return type of your 'get_weekly_report_data' function
interface WeeklyReportData {
  startDate: string; // YYYY-MM-DD format expected
  endDate: string;   // YYYY-MM-DD format expected
  completionSummary: {
    startup: { completed: number; total: number; rate: number; daily: boolean[] };
    shutdown: { completed: number; total: number; rate: number; daily: boolean[] };
  };
  habitConsistency: Array<{
    id: string;
    name: string;
    timing: string; // e.g., 'AM', 'PM', 'ANYTIME'
    completed: number;
    total: number;
    rate: number;
    daily: boolean[]; // Array of 7 booleans (Sun-Sat)
  }>;
  ratingsTrend: Array<{
    date: string; // YYYY-MM-DD format expected
    prev_evening: number | null;
    sleep: number | null;
    morning: number | null;
    day: number | null;
  }>;
  qualitativeReview: {
    feelings: string[];
    accomplishments: string[];
    improvements: string[];
  };
}

// Helper component for rendering daily status icons (check/cross)
const StatusIcon = ({ completed }: { completed: boolean }) => {
  return completed ? (
    <span className="text-green-500" title="Completed">✓</span>
  ) : (
    <span className="text-red-500" title="Missed">✕</span>
  );
};

// Constant for initial number of qualitative items to show before expanding
const INITIAL_QUALITATIVE_LIMIT = 3;

export default function WeeklyReportPage() {
  const router = useRouter();
  // State for the fetched report data
  const [reportData, setReportData] = useState<WeeklyReportData | null>(null);
  // State for loading indicator
  const [loading, setLoading] = useState(true);
  // State for error messages
  const [error, setError] = useState<string | null>(null);
  // State for the calculated start date of the week being reported
  const [weekStartDate, setWeekStartDate] = useState<Date | null>(null);
  // State for expanding/collapsing the feelings list
  const [isFeelingsExpanded, setIsFeelingsExpanded] = useState(false);

  // Effect hook to calculate the target week's start date on component mount
  useEffect(() => {
    const today = new Date();
    // Get the start of the current week (assuming Sunday is the start)
    const currentWeekStart = startOfWeek(today, { weekStartsOn: 0 });
    // Default to reporting the week starting from currentWeekStart.
    // If today *is* Sunday, we want the report for the *previous* completed week.
    const targetWeekStart = today.getDay() === 0 ? subDays(currentWeekStart, 7) : currentWeekStart;
    setWeekStartDate(targetWeekStart);
    console.log("WeeklyReportPage: Target week start date set to:", format(targetWeekStart, 'yyyy-MM-dd'));
  }, []); // Empty dependency array ensures this runs only once on mount


  // Effect hook to fetch report data when the weekStartDate is set
  useEffect(() => {
    // Do nothing if the start date hasn't been calculated yet
    if (!weekStartDate) return;

    const fetchReport = async () => {
      console.log("WeeklyReportPage: Starting data fetch for week starting:", format(weekStartDate, 'yyyy-MM-dd'));
      setLoading(true);
      setError(null); // Clear previous errors
      setReportData(null); // Clear previous data

      try {
        // --- Start Fix: Initialize Supabase client and check for null ---
        const supabase = getSupabaseClient();
        if (!supabase) {
            console.error('WeeklyReportPage: Supabase client is null. Check environment configuration.');
            // Throw an error to be handled by the catch block below
            throw new Error('Database connection failed. Please check setup or try again later.');
        }
        console.log("WeeklyReportPage: Supabase client initialized.");
        // --- End Fix ---

        // 1. Get the current authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        // Handle auth errors or no user found
        if (authError) {
            console.error("WeeklyReportPage: Error fetching user:", authError);
            throw authError;
        }
        if (!user) {
          console.log("WeeklyReportPage: No user logged in, redirecting to signin.");
          router.push('/auth/signin'); // Redirect if not logged in
          return; // Stop execution for this effect
        }
        console.log("WeeklyReportPage: User found:", user.id);

        // 2. Format the start date for the RPC call
        const formattedStartDate = format(weekStartDate, 'yyyy-MM-dd');

        // 3. Call the Supabase RPC function to get report data
        console.log("WeeklyReportPage: Calling RPC 'get_weekly_report_data' with user:", user.id, "and date:", formattedStartDate);
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_weekly_report_data', {
          // Pass parameters expected by your PostgreSQL function
          target_user_id: user.id,
          week_start_date: formattedStartDate
        });

        // Handle errors from the RPC call
        if (rpcError) {
            console.error("WeeklyReportPage: RPC error:", rpcError);
            throw rpcError; // Throw error to be caught below
        }

        // 4. Process the received data
        if (rpcData) {
          console.log("WeeklyReportPage: Report data received successfully.");
          // Cast the data to the defined interface type
          setReportData(rpcData as WeeklyReportData);
        } else {
           // Handle case where RPC returns no data without error
           console.warn("WeeklyReportPage: RPC returned no data for the specified week.");
           setReportData(null); // Ensure reportData is null
        }

      } catch (err: unknown) {
        // Catch any errors from initialization, auth, or RPC call
        console.error('WeeklyReportPage: Error during fetchReport execution:', err);
        // Set a user-friendly error message
        setError(err instanceof Error ? err.message : 'Failed to load weekly report data due to an unexpected error.');
      } finally {
        // Ensure loading state is turned off regardless of success or failure
        setLoading(false);
        console.log("WeeklyReportPage: Data fetch process finished.");
      }
    };

    fetchReport(); // Execute the fetch function

  // Dependency array: Re-run effect if weekStartDate or router changes
  // Router is included typically for stability if redirects happen, though often optional
  }, [weekStartDate, router]);

  // Helper function to format date labels for the Recharts X-axis
  const formatXAxis = (tickItem: string): string => {
     try {
         // Attempt to parse the date string (YYYY-MM-DD) and format it
         // Adding T00:00:00 helps avoid potential timezone shifts during formatting
         return format(new Date(tickItem + 'T00:00:00'), 'MMM d'); // e.g., "Apr 21"
     } catch {
         // Fallback to the original string if parsing/formatting fails
         return tickItem;
     }
  };

  // --- Render Logic ---

  // Display loading state
  if (loading) {
    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            {/* Simple loading spinner */}
            <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <p className="ml-3 text-gray-600">Loading Weekly Report...</p>
        </div>
    );
  }

  // Display error state
  if (error) {
     return (
         <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
             {/* Header with back link */}
             <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                 <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Weekly Report</h1>
                 <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline">&larr; Back to Dashboard</Link>
             </div>
             {/* Error Banner */}
             <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
                 <p className="font-semibold">Error Loading Report</p>
                 <p>{error}</p>
             </div>
         </div>
     );
  }

  // Display message if no report data was found (but no error occurred)
  if (!reportData) {
     return (
         <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
              {/* Header with back link */}
             <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                 <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Weekly Report</h1>
                 <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline">&larr; Back to Dashboard</Link>
             </div>
             {/* No data message */}
             <p className="text-center text-gray-500 py-10">No report data found for the specified week.</p>
         </div>
     );
  }

  // --- Main Report Display (Rendered when data is available) ---
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]; // For table headers

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 font-sans">
      {/* Report Header */}
       <div className="flex items-center justify-between flex-wrap gap-4 border-b pb-4 border-gray-200">
           <div>
               <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Weekly Report</h1>
               {/* Display the date range of the report */}
               <p className="text-sm text-gray-500 mt-1">
                   Showing data from {format(new Date(reportData.startDate + 'T00:00:00'), 'MMM d, yyyy')}
                   {' '}to {format(new Date(reportData.endDate + 'T00:00:00'), 'MMM d, yyyy')}
               </p>
           </div>
           {/* Back to Dashboard Link */}
           <Link href="/dashboard" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
               &larr; Back to Dashboard
           </Link>
       </div>

      {/* Section: Completion Summary */}
      <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Completion Summary</h2>
          <div className="overflow-x-auto">
              {/* Table for Startup/Shutdown completion */}
              <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                      <tr>
                          <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">Routine</th>
                          {/* Daily status headers */}
                          {daysOfWeek.map(day => <th key={day} scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{day}</th>)}
                          <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Weekly Rate</th>
                      </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                      {/* Startup Row */}
                      <tr>
                          <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Startup</td>
                          {/* Map daily statuses */}
                          {reportData.completionSummary.startup.daily.map((status, index) => <td key={index} className="px-3 py-4 text-center text-sm"><StatusIcon completed={status} /></td>)}
                          {/* Display weekly rate */}
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 text-right font-medium">
                              {reportData.completionSummary.startup.rate}% ({reportData.completionSummary.startup.completed}/{reportData.completionSummary.startup.total})
                          </td>
                      </tr>
                      {/* Shutdown Row */}
                      <tr>
                          <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Shutdown</td>
                           {/* Map daily statuses */}
                          {reportData.completionSummary.shutdown.daily.map((status, index) => <td key={index} className="px-3 py-4 text-center text-sm"><StatusIcon completed={status} /></td>)}
                           {/* Display weekly rate */}
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 text-right font-medium">
                              {reportData.completionSummary.shutdown.rate}% ({reportData.completionSummary.shutdown.completed}/{reportData.completionSummary.shutdown.total})
                          </td>
                      </tr>
                  </tbody>
              </table>
          </div>
      </div>

      {/* Section: Habit Consistency */}
        <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Habit Consistency</h2>
            {/* Conditional rendering based on whether habits exist */}
            {reportData.habitConsistency.length > 0 ? (
                <div className="overflow-x-auto">
                    {/* Table for habit consistency */}
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">Habit</th>
                                {/* Daily status headers */}
                                {daysOfWeek.map(day => <th key={day} scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{day}</th>)}
                                <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Weekly Rate</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {/* Map through each habit */}
                            {reportData.habitConsistency.map((habit) => (
                                <tr key={habit.id}>
                                    {/* Habit name */}
                                    <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{habit.name} <span className="text-xs text-gray-400">({habit.timing})</span></td>
                                    {/* Map daily statuses */}
                                    {habit.daily.map((status, index) => <td key={index} className="px-3 py-4 text-center text-sm"><StatusIcon completed={status} /></td>)}
                                    {/* Display weekly rate */}
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 text-right font-medium">
                                        {habit.rate}% ({habit.completed}/{habit.total})
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                // Message shown if no habits were tracked
                <p className="text-gray-500 text-center py-4 italic">No habits tracked this week.</p>
            )}
        </div>

      {/* Section: Ratings Trend */}
       <div className="bg-white shadow-md rounded-lg p-6">
           <h2 className="text-xl font-semibold mb-4 text-gray-800">Ratings Trend</h2>
           {/* Container for the line chart */}
           <div style={{ width: '100%', height: 300 }}>
               <ResponsiveContainer>
                   <LineChart
                       data={reportData.ratingsTrend} // Provide data array
                       margin={{ top: 5, right: 20, left: -10, bottom: 5 }} // Adjust margins
                   >
                       {/* Grid lines */}
                       <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0"/>
                       {/* X-axis (Date) */}
                       <XAxis
                           dataKey="date" // Use the 'date' field from data
                           tickFormatter={formatXAxis} // Format ticks using helper function
                           dy={5} // Offset tick labels vertically
                           tick={{ fontSize: 12 }} // Style tick labels
                       />
                       {/* Y-axis (Rating) */}
                       <YAxis
                           domain={[1, 5]} // Set fixed domain for ratings 1-5
                           ticks={[1, 2, 3, 4, 5]} // Specify tick values
                           width={40} // Adjust width for labels
                           tick={{ fontSize: 12 }} // Style tick labels
                       />
                       {/* Tooltip on hover */}
                       <Tooltip />
                       {/* Legend */}
                       <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                       {/* Define lines for each rating type */}
                       <Line type="monotone" dataKey="prev_evening" name="Prev Evening" stroke="#8884d8" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
                       <Line type="monotone" dataKey="sleep" name="Sleep" stroke="#82ca9d" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
                       <Line type="monotone" dataKey="morning" name="Morning" stroke="#ffc658" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
                       <Line type="monotone" dataKey="day" name="Day Overall" stroke="#ff7300" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
                   </LineChart>
               </ResponsiveContainer>
           </div>
       </div>

      {/* Section: Qualitative Review */}
      <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Qualitative Review</h2>
          {/* Grid layout for qualitative sections */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Morning Feelings */}
              <div>
                  <h3 className="font-medium mb-2 text-gray-700">Morning Feelings</h3>
                  {(() => {
                      const feelings = reportData.qualitativeReview.feelings;
                      // Determine if there are more feelings than the initial limit
                      const showFeelingsToggleButton = feelings.length > INITIAL_QUALITATIVE_LIMIT;
                      // Slice the array based on whether it's expanded or not
                      const displayedFeelings = isFeelingsExpanded ? feelings : feelings.slice(0, INITIAL_QUALITATIVE_LIMIT);

                      return (
                          <>
                              {/* Display list or 'No entries' message */}
                              {displayedFeelings.length > 0 ? (
                                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                                      {displayedFeelings.map((item, index) => <li key={index}>{item}</li>)}
                                  </ul>
                              ) : <p className="text-sm text-gray-500 italic">No entries</p>}
                              {/* Show toggle button if needed */}
                              {showFeelingsToggleButton && (
                                  <button
                                      onClick={() => setIsFeelingsExpanded(!isFeelingsExpanded)}
                                      className="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 focus:outline-none"
                                  >
                                      {isFeelingsExpanded ? 'Show Less' : `Show More (${feelings.length - INITIAL_QUALITATIVE_LIMIT} more)`}
                                  </button>
                              )}
                          </>
                      );
                  })()}
              </div>
              {/* Accomplishments */}
              <div>
                  <h3 className="font-medium mb-2 text-gray-700">Accomplishments</h3>
                  {reportData.qualitativeReview.accomplishments.length > 0 ? (
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                          {reportData.qualitativeReview.accomplishments.map((item, index) => <li key={index}>{item}</li>)}
                      </ul>
                  ) : <p className="text-sm text-gray-500 italic">No entries</p>}
              </div>
              {/* Areas for Improvement */}
              <div>
                  <h3 className="font-medium mb-2 text-gray-700">Areas for Improvement</h3>
                  {reportData.qualitativeReview.improvements.length > 0 ? (
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                          {reportData.qualitativeReview.improvements.map((item, index) => <li key={index}>{item}</li>)}
                      </ul>
                  ) : <p className="text-sm text-gray-500 italic">No entries</p>}
              </div>
          </div>
      </div>
    </div>
  );
}