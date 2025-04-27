'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getSupabaseClient } from '@/lib/supabase/supabaseClient';
import { Habit, HabitTiming, StartupFormData } from '@/types';
import { getHabitsForUser } from '@/lib/supabase/habits';
import { useDailyLogStore } from '@/stores/dailyLogStore';
import { CheckCircleIcon, ClockIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { LoadingOverlay } from '@/components/common/LoadingOverlay';

interface AmHabitsStepProps {
  initialValue: string[];
  onNext: (data: Partial<StartupFormData>) => void;
  onBack: () => void;
}

/**
 * Morning‑startup habit picker – each habit row can be "done", "deferred", or "didNotDo".
 * State is kept in a single map to avoid conflicting sets and render loops.
 */
export default function AmHabitsStep({ initialValue, onNext, onBack }: AmHabitsStepProps) {
  /* ───────────────── local state ───────────────── */
  const [available, setAvailable] = useState<Habit[]>([]);
  const [habitStatus, setHabitStatus] = useState<Record<string, 'done' | 'deferred' | 'didNotDo' | null>>({});
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  /* ─────── Zustand store helpers (NO new‑array trap) ─────── */
  const markDeferred   = useDailyLogStore(s => s.markHabitDeferred);
  const unmarkDeferred = useDailyLogStore(s => s.unmarkHabitDeferred);
  // returning null instead of [] prevents infinite re‑renders
  const deferredIdsArr = useDailyLogStore(s => s.todayLog?.deferred_from_startup || null);
  const deferredSet    = useMemo(() => new Set(deferredIdsArr ?? []), [deferredIdsArr]);

  /* ───────────────── fetch AM habits once ────────────────── */
  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true); setError(null);
        const sb = getSupabaseClient();
        if (!sb) throw new Error('Supabase not initialised');
        const { data: { user } } = await sb.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        const all = await getHabitsForUser(user.id);
        const am  = all.filter(h => h.timing === HabitTiming.AM)
                       .sort((a,b)=>(a.sort_order??Infinity)-(b.sort_order??Infinity));
        setAvailable(am);

        // seed initial status map
        const map: Record<string,'done'|'deferred'|'didNotDo'|null> = {};
        initialValue.forEach(id => map[id] = 'done');
        deferredSet.forEach(id => { if (!map[id]) map[id] = 'deferred'; });
        setHabitStatus(map);
      } catch (e:any) {
        setError(e.message || 'Failed to load habits');
      } finally { setLoading(false); }
    };
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ───────────────── status changer (loop‑safe) ───────────── */
  const setStatus = useCallback((habitId:string, status:'done'|'deferred'|'didNotDo') => {
    setHabitStatus(prev => {
      if (prev[habitId] === status) return prev;   // no change → no loop
      return { ...prev, [habitId]: status };
    });

    const isDeferredNow = deferredSet.has(habitId);
    if (status === 'deferred' && !isDeferredNow) markDeferred(habitId, 'startup');
    if (status !== 'deferred' &&  isDeferredNow) unmarkDeferred(habitId, 'startup');
  }, [deferredSet, markDeferred, unmarkDeferred]);

  /* ───────────────── submit ───────────────── */
  const complete = () => {
    const doneIds = Object.entries(habitStatus).filter(([,s])=>s==='done').map(([id])=>id);
    onNext({ completed_am_habits: doneIds });
  };

  /* ───────────────── render helpers ────────── */
  const Btn = (props:{habit:Habit; target:'done'|'deferred'|'didNotDo'; Icon:any; active:string; hover:string}) => {
    const { habit, target, Icon, active, hover } = props;
    const isActive = habitStatus[habit.id] === target;
    return (
      <button onClick={()=>setStatus(habit.id, target)} title={target}
        className={`p-1.5 rounded-full transition-colors ${isActive?active:hover}`}> <Icon className="h-5 w-5"/> </button>
    );
  };

  /* ───────────────── render ───────────────── */
  if (loading) return <LoadingOverlay/>;
  if (error)   return <p className="text-red-600 text-center">{error}</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Completed AM Habits</h2>
      <p className="text-sm text-gray-600">Mark your morning habits as &quot;Done&quot;, &quot;Do Later&quot;, or &quot;Did Not Do&quot;.</p>

      <div className="space-y-3 border border-gray-200 rounded-md p-4 bg-white shadow-sm">
        {available.map(habit => {
          const status = habitStatus[habit.id] ?? null;
          return (
            <div key={habit.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
              <span className={`text-sm font-medium ${status==='didNotDo' ? 'text-gray-400 italic line-through' : 'text-gray-900'}`}>{habit.name}</span>

              <div className="flex items-center space-x-2">
                <Btn habit={habit} target="deferred" Icon={ClockIcon}   active="bg-orange-100 text-orange-600 ring-1 ring-orange-300" hover="text-gray-400 hover:text-orange-500 hover:bg-orange-50" />
                <Btn habit={habit} target="done"     Icon={CheckCircleIcon} active="bg-green-100  text-green-600  ring-1 ring-green-300"  hover="text-gray-400 hover:text-green-500 hover:bg-green-50" />
                <Btn habit={habit} target="didNotDo" Icon={XCircleIcon}   active="bg-red-100   text-red-600   ring-1 ring-red-300"   hover="text-gray-400 hover:text-red-500 hover:bg-red-50" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between pt-6">
        <button onClick={onBack} className="px-4 py-2 border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-50">Back</button>
        <button onClick={complete} className="px-4 py-2 rounded-md text-sm text-white bg-green-600 hover:bg-green-700">Complete Startup</button>
      </div>
    </div>
  );
}
