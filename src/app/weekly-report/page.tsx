'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
// Import necessary date-fns functions
import {
  startOfWeek,
  subDays,
  format,
  parseISO,
  getWeek,
  startOfYear,
  addWeeks,
  isSameDay,
  isBefore,
  isAfter,
  endOfWeek,
  addDays // Import addDays for calculating next Sunday
} from 'date-fns';
// Import Supabase client function
import { getSupabaseClient } from '@/lib/supabase/supabaseClient';
// Import Recharts components
import type { User } from '@/types';
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
interface WeeklyReportData {
  startDate: string;
  endDate: string;
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
    date: string;
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

// Define Week Status Enum
enum WeekStatus {
  UNAVAILABLE = 'unavailable',
  FUTURE = 'future',
  PAST_COMPLETED = 'past_completed',
  LATEST_COMPLETED = 'latest_completed',
  CURRENT_IN_PROGRESS = 'current_in_progress',
}

// Define Week Info structure
interface WeekInfo {
  weekNumber: number;
  startDate: Date;
  status: WeekStatus;
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

// Simple SVG Gear Icon Component
const GearIcon = () => (
    <svg className="animate-spin h-5 w-5 text-gray-500 mr-2 inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 16v-2m8-8h-2M6 12H4m13.657-5.657-.707-.707M6.343 17.657l-.707-.707m12.021 0-.707.707M6.343 6.343l-.707.707M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"/>
    </svg>
);


export default function WeeklyReportPage() {
  const router = useRouter();

  // --- State ---
  const [user, setUser] = useState<User | null>(null);
  const [firstLogDate, setFirstLogDate] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [selectedWeekStartDate, setSelectedWeekStartDate] = useState<Date | null>(null);
  const [reportData, setReportData] = useState<WeeklyReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [yearWeeks, setYearWeeks] = useState<WeekInfo[]>([]);
  const [isFeelingsExpanded, setIsFeelingsExpanded] = useState(false);
  const [showPendingMessage, setShowPendingMessage] = useState(false);

  // --- Effect 1: Fetch User and First Log Date ---
  useEffect(() => {
    const fetchInitialData = async () => {
      console.log("WeeklyReportPage: Starting initial data fetch...");
      setInitialLoading(true); setInitialError(null); setUser(null); setFirstLogDate(null); setYearWeeks([]); setShowPendingMessage(false);
      const supabase = getSupabaseClient();
      if (!supabase) { setInitialError('Database connection failed.'); setInitialLoading(false); return; }
      try {
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!authUser) { router.push('/auth/signin'); return; }
        const appUser: User = { id: authUser.id, email: authUser.email ?? 'N/A', created_at: authUser.created_at ?? new Date().toISOString() };
        setUser(appUser);
        const { data: firstLogEntry, error: firstLogError } = await supabase.from('daily_logs').select('log_date').eq('user_id', appUser.id).order('log_date', { ascending: true }).limit(1).maybeSingle();
        if (firstLogError && firstLogError.code !== 'PGRST116') { console.error("Error fetching first log date:", firstLogError); }
        setFirstLogDate(firstLogEntry?.log_date ?? null);
      } catch (err: unknown) { console.error('Error during initial data fetch:', err); setInitialError(err instanceof Error ? err.message : 'Failed to load essential page data.'); setUser(null); setFirstLogDate(null);
      } finally { setInitialLoading(false); }
    };
    fetchInitialData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // --- Effect 2: Determine Default Selected Week ---
  useEffect(() => {
      if (initialLoading || !user) return;
      const today = new Date();
      const currentWeekStart = startOfWeek(today, { weekStartsOn: 0 });
      const latestReportableWeekStart = today.getDay() === 0 ? subDays(currentWeekStart, 7) : startOfWeek(subDays(today, 7), { weekStartsOn: 0 });

      // --- FIXED: Explicitly type defaultStartDate as Date | null ---
      let defaultStartDate: Date | null = latestReportableWeekStart;

      if (firstLogDate) {
          try {
              const firstWeekStart = startOfWeek(parseISO(firstLogDate), { weekStartsOn: 0 });
              if (isBefore(latestReportableWeekStart, firstWeekStart)) {
                  defaultStartDate = null; // No reportable week yet
              }
          } catch (e) {
               console.error("Error parsing firstLogDate:", firstLogDate, e);
               defaultStartDate = null; // Treat as no reportable week if date is invalid
          }
      } else {
          defaultStartDate = null; // No logs means no reportable week
      }
      setSelectedWeekStartDate(defaultStartDate);
      setShowPendingMessage(false);
  }, [initialLoading, user, firstLogDate]);


  // --- Effect 3: Calculate Week Statuses ---
  useEffect(() => {
    if (initialLoading || !user) return;
    console.log("Calculating week statuses...");
    const today = new Date(); const currentYear = today.getFullYear(); const yearStart = startOfYear(today); const firstWeekStart = firstLogDate ? startOfWeek(parseISO(firstLogDate), { weekStartsOn: 0 }) : null; const currentWeekStart = startOfWeek(today, { weekStartsOn: 0 }); const latestReportableWeekStart = today.getDay() === 0 ? subDays(currentWeekStart, 7) : startOfWeek(subDays(today, 7), { weekStartsOn: 0 });
    const weeks: WeekInfo[] = [];
    for (let i = 0; i < 53; i++) {
      const weekStartDate = startOfWeek(addWeeks(yearStart, i), { weekStartsOn: 0 }); if (weekStartDate.getFullYear() > currentYear) break; if (weekStartDate.getFullYear() < currentYear && i > 0) continue;
      const weekNumber = getWeek(weekStartDate, { weekStartsOn: 0 }); let status: WeekStatus;
      if (firstWeekStart && isBefore(weekStartDate, firstWeekStart)) { status = WeekStatus.UNAVAILABLE; } else if (isSameDay(weekStartDate, currentWeekStart)) { status = WeekStatus.CURRENT_IN_PROGRESS; } else if (isAfter(weekStartDate, currentWeekStart)) { status = WeekStatus.FUTURE; } else if (isSameDay(weekStartDate, latestReportableWeekStart)) { status = (firstWeekStart && isBefore(weekStartDate, firstWeekStart)) ? WeekStatus.UNAVAILABLE : WeekStatus.LATEST_COMPLETED; } else if (isBefore(weekStartDate, latestReportableWeekStart)) { status = (firstWeekStart && isBefore(weekStartDate, firstWeekStart)) ? WeekStatus.UNAVAILABLE : WeekStatus.PAST_COMPLETED; } else { status = WeekStatus.FUTURE; }
      if (!firstWeekStart && isBefore(weekStartDate, currentWeekStart)) { status = WeekStatus.UNAVAILABLE; }
      weeks.push({ weekNumber, startDate: weekStartDate, status });
    }
    const uniqueWeeks = weeks.filter((week, index, self) => index === self.findIndex((w) => w.weekNumber === week.weekNumber && w.startDate.getFullYear() === currentYear));
    setYearWeeks(uniqueWeeks);
  }, [initialLoading, user, firstLogDate]);


  // --- Effect 4: Fetch Report Data ---
  useEffect(() => {
    if (!user || !selectedWeekStartDate || showPendingMessage) {
        if (!selectedWeekStartDate || showPendingMessage) setReportData(null);
        return;
    }
    const fetchReport = async () => {
      const formattedStartDate = format(selectedWeekStartDate, 'yyyy-MM-dd');
      console.log(`Fetching report for week: ${formattedStartDate}`);
      setReportLoading(true); setReportError(null); setReportData(null);
      try {
        const supabase = getSupabaseClient(); if (!supabase) throw new Error('Database connection failed.');
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_weekly_report_data', { target_user_id: user.id, week_start_date: formattedStartDate });
        if (rpcError) throw rpcError;
        setReportData(rpcData as WeeklyReportData);
      } catch (err: unknown) { console.error('Error fetching report data:', err); setReportError(err instanceof Error ? err.message : 'Failed to load report data.');
      } finally { setReportLoading(false); }
    };
    fetchReport();
  }, [selectedWeekStartDate, user, showPendingMessage]);


  // --- Helper: Format X-Axis ---
  const formatXAxis = (tickItem: string): string => {
     try { return format(parseISO(tickItem), 'MMM d'); } catch { return tickItem; }
  };

  // --- Helper function to get Tailwind classes based on status ---
  const getWeekButtonClasses = (week: WeekInfo): string => {
    const baseClasses = "h-8 w-8 rounded-full text-xs flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 transition-colors duration-150 font-medium";
    let statusClasses = ""; let selectedClasses = "";
    switch (week.status) {
      case WeekStatus.UNAVAILABLE: statusClasses = "bg-gray-200 text-gray-400 cursor-not-allowed opacity-70"; break;
      case WeekStatus.FUTURE: statusClasses = "bg-gray-300 text-gray-500 cursor-not-allowed"; break;
      case WeekStatus.CURRENT_IN_PROGRESS: statusClasses = "bg-yellow-100 text-yellow-800 border border-yellow-400 border-dashed hover:bg-yellow-200 cursor-pointer"; break;
      case WeekStatus.PAST_COMPLETED: statusClasses = "bg-green-100 text-green-800 hover:bg-green-200 border border-green-300 cursor-pointer"; break;
      case WeekStatus.LATEST_COMPLETED: statusClasses = "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300 cursor-pointer"; break;
    }
    if (selectedWeekStartDate && isSameDay(week.startDate, selectedWeekStartDate)) {
        if(week.status === WeekStatus.LATEST_COMPLETED) { selectedClasses = "ring-2 ring-emerald-500 font-bold"; }
        else if (week.status === WeekStatus.PAST_COMPLETED) { selectedClasses = "ring-2 ring-green-500 font-bold"; }
        else if (week.status === WeekStatus.CURRENT_IN_PROGRESS) { selectedClasses = "bg-yellow-200 font-bold"; }
    }
    return `${baseClasses} ${statusClasses} ${selectedClasses}`;
  };

  // --- Click Handler for Week Buttons ---
  const handleWeekSelect = (week: WeekInfo) => {
    setSelectedWeekStartDate(week.startDate); setReportError(null); setReportData(null);
    if (week.status === WeekStatus.PAST_COMPLETED || week.status === WeekStatus.LATEST_COMPLETED) {
      setShowPendingMessage(false); console.log("Selected completed week:", week.weekNumber, format(week.startDate, 'yyyy-MM-dd'));
    } else if (week.status === WeekStatus.CURRENT_IN_PROGRESS) {
      setShowPendingMessage(true); console.log("Selected current week:", week.weekNumber, format(week.startDate, 'yyyy-MM-dd'), "- Report Pending");
    } else { setShowPendingMessage(false); console.log("Cannot select week:", week.weekNumber, week.status); }
  };


  // --- Render Logic ---

  // Handle initial loading/error states
  if (initialLoading) { return <div className="min-h-screen flex items-center justify-center p-4"><svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><p className="ml-3 text-gray-600">Loading User Data...</p></div>; }
  if (initialError) { return <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8"><div className="flex items-center justify-between mb-6 flex-wrap gap-4"><h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Weekly Report</h1><Link href="/dashboard" className="text-sm text-indigo-600 hover:underline">&larr; Back to Dashboard</Link></div><div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert"><p className="font-semibold">Error Loading Page</p><p>{initialError}</p></div></div>; }
  if (!user) { return <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8"><p className="text-center text-gray-500 py-10">Could not load user information.</p><Link href="/dashboard" className="block text-center text-sm text-indigo-600 hover:underline mt-4">&larr; Back to Dashboard</Link></div>; }

  // Prepare variables for rendering
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const currentYearForTitle = yearWeeks[0]?.startDate.getFullYear() ?? new Date().getFullYear();
  const nextSundayDate = selectedWeekStartDate && showPendingMessage ? format(addDays(endOfWeek(selectedWeekStartDate, { weekStartsOn: 0 }), 1), 'MMMM do') : '';

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 font-sans">
      {/* Header */}
       <div className="flex items-center justify-between flex-wrap gap-4 border-b pb-4 border-gray-200">
           <div>
               <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Weekly Report</h1>
               <p className="text-sm text-gray-500 mt-1">
                   {showPendingMessage ? `Report pending for week of ${format(selectedWeekStartDate!, 'MMM d, yyyy')}`
                   : reportLoading ? 'Loading report...'
                   : reportData ? `Showing data from ${format(parseISO(reportData.startDate), 'MMM d, yyyy')} to ${format(parseISO(reportData.endDate), 'MMM d, yyyy')}`
                   : selectedWeekStartDate ? `Week of ${format(selectedWeekStartDate, 'MMM d, yyyy')}`
                   : 'Select a week' }
               </p>
           </div>
           <Link href="/dashboard" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"> &larr; Back to Dashboard </Link>
       </div>

       {/* Week Selector UI */}
        <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg shadow-sm">
            <h2 className="text-lg font-semibold mb-4 text-center text-gray-700">Select Week ({currentYearForTitle})</h2>
            <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto">
                {yearWeeks.length === 0 && !initialLoading && <p className="text-gray-500 text-sm">Calculating week statuses...</p>}
                {yearWeeks.map((week) => (
                    <button key={week.startDate.toISOString()} className={getWeekButtonClasses(week)} title={`Week ${week.weekNumber} (Starts ${format(week.startDate, 'MMM d')}) - Status: ${week.status.replace(/_/g, ' ')}`} onClick={() => handleWeekSelect(week)} disabled={week.status === WeekStatus.UNAVAILABLE || week.status === WeekStatus.FUTURE}> {week.weekNumber} </button>
                ))}
            </div>
             <p className="text-xs text-center text-gray-500 mt-3">
                {firstLogDate ? `Tracking started: ${format(parseISO(firstLogDate), 'MMM d, yyyy')}` : 'No activity logged yet.'}
             </p>
        </div>

      {/* Conditional Report Display Area */}
      {showPendingMessage ? ( <div className="text-center py-10 px-4 bg-yellow-50 border border-yellow-200 rounded-lg"> <GearIcon /> <p className="mt-2 text-yellow-800 font-medium">Report In Progress</p> <p className="text-sm text-gray-600"> The report for the week of {format(selectedWeekStartDate!, 'MMM d')} will be available on <span className="font-semibold">{nextSundayDate}</span>. </p> </div> )
      : reportLoading ? ( <div className="text-center py-10"> <svg className="animate-spin h-6 w-6 text-indigo-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> <p className="mt-2 text-gray-600">Loading report data...</p> </div> )
      : reportError ? ( <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md my-4" role="alert"><p className="font-semibold">Error Loading Report</p><p>{reportError}</p></div> )
      : !selectedWeekStartDate ? ( <p className="text-center text-gray-500 py-10">Select a completed week above to view its report.</p> )
      : !reportData ? ( <p className="text-center text-gray-500 py-10">No report data found for the selected week.</p> )
      : (
        // --- Report Sections ---
        <>
          {/* Completion Summary */}
          <div className="bg-white shadow-md rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Completion Summary</h2>
              <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                          <tr>
                              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">Routine</th>
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
                                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">Habit</th>
                                    {daysOfWeek.map(day => <th key={day} scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{day}</th>)}
                                    <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Weekly Rate</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {reportData.habitConsistency.map((habit) => (
                                    <tr key={habit.id}>
                                        <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{habit.name} <span className="text-xs text-gray-400">({habit.timing})</span></td>
                                        {habit.daily.map((status, index) => <td key={index} className="px-3 py-4 text-center text-sm"><StatusIcon completed={status} /></td>)}
                                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 text-right font-medium">{habit.rate}% ({habit.completed}/{habit.total})</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                 ) : ( <p className="text-gray-500 text-center py-4 italic">No habits tracked this week.</p> )}
          </div>

          {/* Ratings Trend */}
           <div className="bg-white shadow-md rounded-lg p-6">
               <h2 className="text-xl font-semibold mb-4 text-gray-800">Ratings Trend</h2>
               <div style={{ width: '100%', height: 300 }}>
                   <ResponsiveContainer>
                       <LineChart data={reportData.ratingsTrend} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                           <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0"/>
                           <XAxis dataKey="date" tickFormatter={formatXAxis} dy={5} tick={{ fontSize: 12 }} />
                           <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} width={40} tick={{ fontSize: 12 }} />
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

          {/* Qualitative Review - Styled Tags */}
          <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold mb-4 text-gray-800 text-center">Qualitative Review</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Card 1: Morning Feelings */}
                  <div className="bg-white p-4 rounded-lg shadow border border-gray-100">
                      <h3 className="font-semibold mb-3 text-gray-700 text-center border-b pb-2">Morning Feelings</h3>
                      {(() => {
                          const feelings = reportData?.qualitativeReview?.feelings ?? [];
                          const showFeelingsToggleButton = feelings.length > INITIAL_QUALITATIVE_LIMIT;
                          const displayedFeelings = isFeelingsExpanded ? feelings : feelings.slice(0, INITIAL_QUALITATIVE_LIMIT);
                          return ( <div className="space-y-2 text-center"> {displayedFeelings.length > 0 ? ( <div className="space-y-1"> {displayedFeelings.map((item, index) => ( <span key={index} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md inline-block mx-1 my-0.5 text-sm">{item}</span> ))} </div> ) : <p className="text-sm text-gray-500 italic text-center">No entries</p>} {showFeelingsToggleButton && ( <button onClick={() => setIsFeelingsExpanded(!isFeelingsExpanded)} className="mt-2 w-full text-center text-xs font-medium text-indigo-600 hover:text-indigo-800 focus:outline-none"> {isFeelingsExpanded ? 'Show Less' : `Show More (${feelings.length - INITIAL_QUALITATIVE_LIMIT} more)`} </button> )} </div> );
                      })()}
                  </div>
                  {/* Card 2: Accomplishments */}
                  <div className="bg-white p-4 rounded-lg shadow border border-gray-100">
                      <h3 className="font-semibold mb-3 text-gray-700 text-center border-b pb-2">Accomplishments</h3>
                      <div className="space-y-2 text-center"> {(reportData?.qualitativeReview?.accomplishments ?? []).length > 0 ? ( <div className="space-y-1"> {(reportData?.qualitativeReview?.accomplishments ?? []).map((item, index) => ( <span key={index} className="bg-green-50 text-green-700 px-2 py-0.5 rounded-md inline-block mx-1 my-0.5 text-sm">{item}</span> ))} </div> ) : <p className="text-sm text-gray-500 italic text-center">No entries</p>} </div>
                  </div>
                  {/* Card 3: Areas for Improvement */}
                  <div className="bg-white p-4 rounded-lg shadow border border-gray-100">
                      <h3 className="font-semibold mb-3 text-gray-700 text-center border-b pb-2">Areas for Improvement</h3>
                       <div className="space-y-2 text-center"> {(reportData?.qualitativeReview?.improvements ?? []).length > 0 ? ( <div className="space-y-1"> {(reportData?.qualitativeReview?.improvements ?? []).map((item, index) => ( <span key={index} className="bg-red-50 text-red-700 px-2 py-0.5 rounded-md inline-block mx-1 my-0.5 text-sm">{item}</span> ))} </div> ) : <p className="text-sm text-gray-500 italic text-center">No entries</p>} </div>
                  </div>
              </div>
          </div>
        </>
      )}
    </div>
  );
}
