'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { startOfWeek, subDays, format } from 'date-fns'; // For date calculations
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

// Define the expected structure of the data returned by the Supabase function
interface WeeklyReportData {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  completionSummary: {
    startup: { completed: number; total: number; rate: number; daily: boolean[] };
    shutdown: { completed: number; total: number; rate: number; daily: boolean[] };
  };
  habitConsistency: Array<{
    id: string;
    name: string;
    timing: string;
    completed: number;
    total: number;
    rate: number;
    daily: boolean[];
  }>;
  ratingsTrend: Array<{
    date: string; // YYYY-MM-DD
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

// Helper component for rendering checkmarks/crosses
const StatusIcon = ({ completed }: { completed: boolean }) => {
  return completed ? (
    <span className="text-green-500" title="Completed">✓</span>
  ) : (
    <span className="text-red-500" title="Missed">✕</span>
  );
};

const INITIAL_QUALITATIVE_LIMIT = 3;

export default function WeeklyReportPage() {
  const router = useRouter();
  const [reportData, setReportData] = useState<WeeklyReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekStartDate, setWeekStartDate] = useState<Date | null>(null);
  const [isFeelingsExpanded, setIsFeelingsExpanded] = useState(false);
  // TODO: Add similar state for accomplishments and improvements if desired

  // Calculate the start date (last Sunday) for the report
  useEffect(() => {
    const today = new Date();
    const currentWeekStart = startOfWeek(today, { weekStartsOn: 0 });
    const targetWeekStart = today.getDay() === 0 ? subDays(currentWeekStart, 7) : currentWeekStart;
    setWeekStartDate(targetWeekStart);
  }, []);


  // Fetch report data when the component mounts or weekStartDate changes
  useEffect(() => {
    if (!weekStartDate) return;

    const fetchReport = async () => {
      setLoading(true);
      setError(null);
      setReportData(null); // Clear previous data on new fetch

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/auth/signin');
          return;
        }
        const formattedStartDate = format(weekStartDate, 'yyyy-MM-dd');
        const { data, error: rpcError } = await supabase.rpc('get_weekly_report_data', {
          target_user_id: user.id,
          week_start_date: formattedStartDate
        });

        if (rpcError) throw rpcError;
        if (data) {
          setReportData(data as WeeklyReportData);
        } else {
           // If function returns null or empty, treat as no data
           setReportData(null); // Ensure reportData is null if no data found
           // Optionally set a specific message instead of generic error
           // setError("No data available for the selected week.");
        }
      } catch (err: any) {
        console.error('Error fetching weekly report:', err);
        setError(err.message || 'Failed to load weekly report data.');
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [weekStartDate, router]);

  // Format date labels for the chart X-axis
  const formatXAxis = (tickItem: string) => {
     try {
         return format(new Date(tickItem + 'T00:00:00'), 'MMM d');
     } catch { return tickItem; }
  };

  // --- Render Logic ---

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="ml-3 text-gray-600">Loading Weekly Report...</p>
      </div>
    );
  }

  if (error) {
     return (
       <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
             <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Weekly Report</h1>
             <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline">&larr; Back to Dashboard</Link>
          </div>
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
             <p className="font-semibold">Error Loading Report</p>
             <p>{error}</p>
          </div>
       </div>
     );
  }

  // Check for reportData *after* loading and error checks
  if (!reportData) {
     return (
         <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
             <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                 <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Weekly Report</h1>
                 <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline">&larr; Back to Dashboard</Link>
             </div>
             <p className="text-center text-gray-500 py-10">No report data found for the previous week.</p>
         </div>
     );
  }

  // ---- Main Report Display ----
  // Now it's safe to access reportData properties
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Header */}
       <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Weekly Report</h1>
            <p className="text-sm text-gray-500">
              Showing data from {format(new Date(reportData.startDate + 'T00:00:00'), 'MMM d, yyyy')} to {format(new Date(reportData.endDate + 'T00:00:00'), 'MMM d, yyyy')}
            </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          &larr; Back to Dashboard
        </Link>
      </div>


      {/* Completion Summary */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Completion Summary</h2>
        <div className="overflow-x-auto">
           <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                 <tr>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Routine</th>
                    {daysOfWeek.map(day => <th key={day} scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{day}</th>)}
                    <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Weekly Rate</th>
                 </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                 <tr>
                    <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Startup</td>
                    {reportData.completionSummary.startup.daily.map((status, index) => <td key={index} className="px-3 py-4 text-center text-sm"><StatusIcon completed={status} /></td>)}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 text-right font-medium">{reportData.completionSummary.startup.rate}% ({reportData.completionSummary.startup.completed}/{reportData.completionSummary.startup.total})</td>
                 </tr>
                 <tr>
                    <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Shutdown</td>
                    {reportData.completionSummary.shutdown.daily.map((status, index) => <td key={index} className="px-3 py-4 text-center text-sm"><StatusIcon completed={status} /></td>)}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 text-right font-medium">{reportData.completionSummary.shutdown.rate}% ({reportData.completionSummary.shutdown.completed}/{reportData.completionSummary.shutdown.total})</td>
                 </tr>
              </tbody>
           </table>
        </div>
      </div>


       {/* Habit Consistency */}
        <div className="bg-white shadow-md rounded-lg p-6">
         <h2 className="text-xl font-semibold mb-4 text-gray-800">Habit Consistency</h2>
         {reportData.habitConsistency.length > 0 ? (
             <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                   <thead className="bg-gray-50">
                      <tr>
                         <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Habit</th>
                         {daysOfWeek.map(day => <th key={day} scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{day}</th>)}
                         <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Weekly Rate</th>
                      </tr>
                   </thead>
                   <tbody className="bg-white divide-y divide-gray-200">
                      {reportData.habitConsistency.map((habit) => (
                         <tr key={habit.id}>
                            <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{habit.name}</td>
                            {habit.daily.map((status, index) => <td key={index} className="px-3 py-4 text-center text-sm"><StatusIcon completed={status} /></td>)}
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 text-right font-medium">{habit.rate}% ({habit.completed}/{habit.total})</td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
         ) : (
             <p className="text-gray-500 text-center py-4">No habits tracked this week.</p>
         )}
       </div>


      {/* Ratings Trend */}
       <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Ratings Trend</h2>
        <div style={{ width: '100%', height: 300 }}> {/* Set explicit height for chart container */}
          <ResponsiveContainer>
            <LineChart
              data={reportData.ratingsTrend}
              margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0"/>
              <XAxis dataKey="date" tickFormatter={formatXAxis} dy={5} tick={{ fontSize: 12 }}/>
              <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} width={40} tick={{ fontSize: 12 }}/>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Line type="monotone" dataKey="prev_evening" name="Prev Evening" stroke="#8884d8" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
              <Line type="monotone" dataKey="sleep" name="Sleep" stroke="#82ca9d" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
              <Line type="monotone" dataKey="morning" name="Morning" stroke="#ffc658" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
              <Line type="monotone" dataKey="day" name="Day Overall" stroke="#ff7300" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>


      {/* Qualitative Review */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Qualitative Review</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Morning Feelings Section */}
          <div>
            <h3 className="font-medium mb-2 text-gray-700">Morning Feelings</h3>
            {/* --- MOVED LOGIC HERE --- */}
            {(() => {
               // Calculate displayed feelings only if reportData exists
               const feelings = reportData.qualitativeReview.feelings;
               const showFeelingsToggleButton = feelings.length > INITIAL_QUALITATIVE_LIMIT;
               const displayedFeelings = isFeelingsExpanded ? feelings : feelings.slice(0, INITIAL_QUALITATIVE_LIMIT);

               return (
                 <>
                   {displayedFeelings.length > 0 ? (
                     <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                       {displayedFeelings.map((item, index) => <li key={index}>{item}</li>)}
                     </ul>
                   ) : <p className="text-sm text-gray-500 italic">No entries</p>}

                   {showFeelingsToggleButton && (
                     <button
                       onClick={() => setIsFeelingsExpanded(!isFeelingsExpanded)}
                       className="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-800"
                     >
                       {isFeelingsExpanded ? 'Show Less' : `Show More (${feelings.length - INITIAL_QUALITATIVE_LIMIT} more)`}
                     </button>
                   )}
                 </>
               );
            })()}
            {/* --- END MOVED LOGIC --- */}
          </div>

          {/* Accomplishments */}
          <div>
            <h3 className="font-medium mb-2 text-gray-700">Accomplishments</h3>
             {reportData.qualitativeReview.accomplishments.length > 0 ? (
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                {reportData.qualitativeReview.accomplishments.map((item, index) => <li key={index}>{item}</li>)}
              </ul>
             ) : <p className="text-sm text-gray-500 italic">No entries</p>}
             {/* TODO: Add Show More/Less button if desired */}
          </div>
          {/* Improvements */}
          <div>
            <h3 className="font-medium mb-2 text-gray-700">Areas for Improvement</h3>
             {reportData.qualitativeReview.improvements.length > 0 ? (
               <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                {reportData.qualitativeReview.improvements.map((item, index) => <li key={index}>{item}</li>)}
              </ul>
             ) : <p className="text-sm text-gray-500 italic">No entries</p>}
             {/* TODO: Add Show More/Less button if desired */}
          </div>
        </div>
      </div>

    </div>
  );
}
