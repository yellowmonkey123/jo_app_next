'use client';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { StartupFormData, StartupStep } from '@/types';
import { useDailyLogStore } from '@/stores/dailyLogStore';
import { useInitializeSequence } from '@/lib/hooks/useInitializeSequence';
import { getLocalDateString, stripUndefined } from '@/lib/utils/dateUtils';
import { getSupabaseClient } from '@/lib/supabase/supabaseClient';
// step components
import PrevEveningRatingStep   from '@/components/startup/PrevEveningRatingStep';
import SleepRatingStep         from '@/components/startup/SleepRatingStep';
import MorningRatingStep       from '@/components/startup/MorningRatingStep';
import FeelingStep             from '@/components/startup/FeelingStep';
import AmHabitsStep            from '@/components/startup/AmHabitsStep';
import ConfirmDeferredShutdownHabitsStep from '@/components/startup/ConfirmDeferredShutdownHabitsStep';
// common
import { LoadingOverlay } from '@/components/common/LoadingOverlay';
import ErrorBanner        from '@/components/common/ErrorBanner';

// ─────────────────────────────────────────────────────────────────────────
// constants / enums
// ─────────────────────────────────────────────────────────────────────────
enum StartupSequence {
  CONFIRM_DEFERRED     = 'confirm-deferred',
  PREV_EVENING_RATING  = StartupStep.PREV_EVENING_RATING,
  SLEEP_RATING         = StartupStep.SLEEP_RATING,
  MORNING_RATING       = StartupStep.MORNING_RATING,
  FEELING              = StartupStep.FEELING,
  AM_HABITS            = StartupStep.AM_HABITS,
}

const initialFormData: StartupFormData = {
  prev_evening_rating: null,
  sleep_rating:        null,
  morning_rating:      null,
  feeling_morning:     '',
  completed_am_habits: [],
};

// ─────────────────────────────────────────────────────────────────────────
// component
// ─────────────────────────────────────────────────────────────────────────
export default function StartupPage() {
  const router = useRouter();
  const { userId, timezone, isInitializing, initError } = useInitializeSequence();
  const { yesterdayLog, loading: storeLoading, error: storeError } = useDailyLogStore();

  const supabase = getSupabaseClient();

  // local state
  const [formData,     setFormData]     = useState<StartupFormData>(initialFormData);
  const [currentStep,  setCurrentStep]  = useState<StartupSequence | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError,  setSubmitError]  = useState<string | null>(null);

  // need confirmation if yesterday had deferred-shutdown habits
  const showConfirmation = useMemo(
    () => !storeLoading && (yesterdayLog?.deferred_from_shutdown?.length ?? 0) > 0,
    [storeLoading, yesterdayLog]
  );

  // ordered sequence
  const stepOrder = useMemo(() => {
    const base = [
      StartupSequence.PREV_EVENING_RATING,
      StartupSequence.SLEEP_RATING,
      StartupSequence.MORNING_RATING,
      StartupSequence.FEELING,
      StartupSequence.AM_HABITS,
    ];
    return showConfirmation ? [StartupSequence.CONFIRM_DEFERRED, ...base] : base;
  }, [showConfirmation]);

  // set first step when init complete
  useEffect(() => {
    if (!isInitializing && currentStep === null) {
      setCurrentStep(stepOrder[0]);
    }
  }, [isInitializing, stepOrder, currentStep]);

  // ── submit handler ────────────────────────────────────────────────────
  const submit = useCallback(
    async (finalFormData: StartupFormData) => {
      if (!userId)       { setSubmitError('User not identified.'); return; }
      if (!timezone)     { setSubmitError('Timezone not identified.'); return; }

      setIsSubmitting(true);
      setSubmitError(null);

      try {
        const logDate = getLocalDateString(timezone);
        if (!logDate) throw new Error('Could not resolve local date.');

        // NEW ➜ pull deferred-from-startup list from Zustand
        const deferredFromStartup =
          useDailyLogStore.getState().todayLog?.deferred_from_startup ?? [];

        const payload = stripUndefined({
          user_id: userId,
          log_date: logDate,
          prev_evening_rating:      finalFormData.prev_evening_rating,
          sleep_rating:             finalFormData.sleep_rating,
          morning_rating:           finalFormData.morning_rating,
          feeling_morning:          finalFormData.feeling_morning,
          completed_am_habits:      finalFormData.completed_am_habits,
          startup_completed_at:     new Date().toISOString(),
          deferred_from_startup:    deferredFromStartup,          // ← added
        });

        if (!supabase) throw new Error('Supabase client not initialised.');

        const { error } = await supabase
          .from('daily_logs')
          .upsert(payload, { onConflict: 'user_id, log_date' });

        if (error) throw error;
        router.push('/dashboard?startup=complete');
      } catch (e: any) {
        setSubmitError(e.message || 'Submit failed.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [userId, timezone, router, supabase]
  );

  // ── navigation ───────────────────────────────────────────────────────
  const handleNext = useCallback(
    (stepData?: Partial<StartupFormData>) => {
      setFormData(prev => ({ ...prev, ...(stepData || {}) }));

      if (!currentStep) return;
      const idx = stepOrder.indexOf(currentStep);
      if (idx < stepOrder.length - 1) {
        setCurrentStep(stepOrder[idx + 1]);
      } else {
        submit({ ...formData, ...(stepData || {}) });
      }
    },
    [currentStep, stepOrder, formData, submit]
  );

  const handleBack = useCallback(() => {
    if (!currentStep) return;
    const idx = stepOrder.indexOf(currentStep);
    if (idx > 0) setCurrentStep(stepOrder[idx - 1]);
    else router.push('/dashboard');
  }, [currentStep, stepOrder, router]);

  // ── render guards ────────────────────────────────────────────────────
  if (initError)  return <ErrorBanner message={`Initialization Error: ${initError}`} />;
  if (storeError) return <ErrorBanner message={`Store Error: ${storeError}`} />;
  if (isInitializing || storeLoading || !currentStep) return <LoadingOverlay />;

  // ── UI ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Morning Startup</h1>
        {!isSubmitting && (
          <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline">Cancel</Link>
        )}
      </header>

      {submitError && <ErrorBanner message={submitError} />}

      <div className="relative bg-white shadow-md rounded-lg p-6 min-h-[350px] flex flex-col">
        {currentStep === StartupSequence.CONFIRM_DEFERRED && (
          <ConfirmDeferredShutdownHabitsStep onNext={handleNext} onBack={handleBack}/>
        )}
        {currentStep === StartupSequence.PREV_EVENING_RATING && (
          <PrevEveningRatingStep initialValue={formData.prev_evening_rating} onNext={handleNext} onBack={handleBack}/>
        )}
        {currentStep === StartupSequence.SLEEP_RATING && (
          <SleepRatingStep initialValue={formData.sleep_rating} onNext={handleNext} onBack={handleBack}/>
        )}
        {currentStep === StartupSequence.MORNING_RATING && (
          <MorningRatingStep initialValue={formData.morning_rating} onNext={handleNext} onBack={handleBack}/>
        )}
        {currentStep === StartupSequence.FEELING && (
          <FeelingStep initialValue={formData.feeling_morning} onNext={handleNext} onBack={handleBack}/>
        )}
        {currentStep === StartupSequence.AM_HABITS && (
          <AmHabitsStep initialValue={formData.completed_am_habits} onNext={handleNext} onBack={handleBack}/>
        )}

        {isSubmitting && <LoadingOverlay overlay/>}
      </div>
    </div>
  );
}
