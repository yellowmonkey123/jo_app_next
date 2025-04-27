import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/supabaseClient';
import { Habit, HabitTiming, ShutdownFormData } from '@/types';
import { getHabitsForUser } from '@/lib/supabase/habits';
import { useDailyLogStore } from '@/stores/dailyLogStore';
import { CheckCircleIcon, ClockIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { LoadingOverlay } from '@/components/common/LoadingOverlay';

interface PmHabitsStepProps {
  initialValue: string[];
  onNext: (data: Partial<ShutdownFormData>) => void;
  onBack: () => void;
}

export default function PmHabitsStep({ initialValue, onNext, onBack }: PmHabitsStepProps) {
  const [availableHabits, setAvailableHabits] = useState<Habit[]>([]);
  const [habitStatus, setHabitStatus] = useState<Record<string, 'done' | 'deferred' | 'didNotDo' | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const markHabitDeferred = useDailyLogStore((state) => state.markHabitDeferred);
  const unmarkHabitDeferred = useDailyLogStore((state) => state.unmarkHabitDeferred);

  useEffect(() => {
    const fetchPmHabits = async () => {
      setLoading(true);
      setError(null);
      try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('Database connection failed.');
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error('User not authenticated.');

        const allHabits = await getHabitsForUser(user.id);
        const pmAnytimeHabits = allHabits.filter(h => h.timing === HabitTiming.PM || h.timing === HabitTiming.ANYTIME);
        pmAnytimeHabits.sort((a, b) => {
          // priority: 0 for ANYTIME, 1 for PM
          const weight = (t: HabitTiming) => (t === HabitTiming.ANYTIME ? 0 : 1);
          const byTiming = weight(a.timing) - weight(b.timing);
          if (byTiming !== 0) return byTiming;
        
          // same timing → alphabetic by name
          return a.name.localeCompare(b.name);
        });

        setAvailableHabits(pmAnytimeHabits);

        const initialStatus: Record<string, 'done' | 'deferred' | 'didNotDo' | null> = {};
        initialValue.forEach(id => {
          initialStatus[id] = 'done';
        });
        setHabitStatus(initialStatus);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load habits.');
      } finally {
        setLoading(false);
      }
    };
    fetchPmHabits();
  }, [initialValue]);

  const handleStatusChange = useCallback((habitId: string, status: 'done' | 'deferred' | 'didNotDo') => {
    setHabitStatus(prev => ({ ...prev, [habitId]: status }));

    // Manage deferred state syncing with store
    if (status === 'deferred') {
      markHabitDeferred(habitId, 'shutdown');
    } else {
      unmarkHabitDeferred(habitId, 'shutdown');
    }
  }, [markHabitDeferred, unmarkHabitDeferred]);

  const handleCompleteClick = useCallback(() => {
    const completedHabitsArray = Object.keys(habitStatus).filter(id => habitStatus[id] === 'done');
    onNext({ completed_pm_anytime_habits: completedHabitsArray });
  }, [habitStatus, onNext]);

  const getTimingLabel = (timing: HabitTiming): string => {
    switch (timing) {
      case HabitTiming.AM: return 'Morning';
      case HabitTiming.PM: return 'Evening';
      case HabitTiming.ANYTIME: return 'Anytime';
      default: return String(timing);
    }
  };

  const getTimingColor = (timing: HabitTiming): string => {
    switch (timing) {
      case HabitTiming.AM: return 'bg-yellow-100 text-yellow-800';
      case HabitTiming.PM: return 'bg-blue-100 text-blue-800';
      case HabitTiming.ANYTIME: return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) return <LoadingOverlay />;
  if (error) return <div className="text-center text-red-600">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Completed PM & Anytime Habits</h2>
      <p className="text-sm text-gray-600">
        Mark your evening & anytime habits as &quot;Done&quot;, &quot;Do Later&quot;, or &quot;Did Not Do&quot;.
      </p>

      <div className="space-y-3 border border-gray-200 rounded-md p-4 bg-white shadow-sm">
        {availableHabits.map(habit => {
          const status = habitStatus[habit.id] || null;
          return (
            <div key={habit.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
              <div>
                <span className={`text-sm font-medium ${status === 'didNotDo' ? 'text-gray-400 italic line-through' : 'text-gray-900'}`}>
                  {habit.name}
                </span>
                <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTimingColor(habit.timing)}`}>
                  {getTimingLabel(habit.timing)}
                </span>
              </div>

              <div className="flex items-center space-x-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleStatusChange(habit.id, 'deferred')}
                  title="Do Later"
                  className={`p-1.5 rounded-full transition-colors duration-150 ease-in-out ${
                    status === 'deferred' ? 'bg-orange-100 text-orange-600 ring-1 ring-orange-300' : 'text-gray-400 hover:text-orange-500 hover:bg-orange-50'
                  }`}
                >
                  <ClockIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange(habit.id, 'done')}
                  title="Done"
                  className={`p-1.5 rounded-full transition-colors duration-150 ease-in-out ${
                    status === 'done' ? 'bg-green-100 text-green-600 ring-1 ring-green-300' : 'text-gray-400 hover:text-green-500 hover:bg-green-50'
                  }`}
                >
                  <CheckCircleIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange(habit.id, 'didNotDo')}
                  title="Did Not Do"
                  className={`p-1.5 rounded-full transition-colors duration-150 ease-in-out ${
                    status === 'didNotDo' ? 'bg-red-100 text-red-600 ring-1 ring-red-300' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                  }`}
                >
                  <XCircleIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between pt-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleCompleteClick}
          disabled={loading || !!error}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
        >
          Complete Shutdown
        </button>
      </div>
    </div>
  );
}
