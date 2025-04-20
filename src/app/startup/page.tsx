// src/app/startup/page.tsx
'use client';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { StartupFormData, StartupStep } from '@/types';
import { useDailyLogStore } from '@/stores/dailyLogStore';
import { useInitializeSequence } from '@/lib/hooks/useInitializeSequence';
import { getLocalDateString, stripUndefined } from '@/lib/utils/dateUtils';
import { getSupabaseClient } from '@/lib/supabase/supabaseClient';
import PrevEveningRatingStep from '@/components/startup/PrevEveningRatingStep';
import SleepRatingStep from '@/components/startup/SleepRatingStep';
import MorningRatingStep from '@/components/startup/MorningRatingStep';
import FeelingStep from '@/components/startup/FeelingStep';
import AmHabitsStep from '@/components/startup/AmHabitsStep';
import ConfirmDeferredShutdownHabitsStep from '@/components/startup/ConfirmDeferredShutdownHabitsStep';
import { LoadingOverlay } from '@/components/common/LoadingOverlay';
import ErrorBanner from '@/components/common/ErrorBanner';

// Sequence enum using existing StartupStep values
enum StartupSequence {
  CONFIRM_DEFERRED = 'confirm-deferred',
  PREV_EVENING_RATING = StartupStep.PREV_EVENING_RATING,
  SLEEP_RATING = StartupStep.SLEEP_RATING,
  MORNING_RATING = StartupStep.MORNING_RATING,
  FEELING = StartupStep.FEELING,
  AM_HABITS = StartupStep.AM_HABITS,
}

const initialFormData: StartupFormData = {
  prev_evening_rating: null,
  sleep_rating: null,
  morning_rating: null,
  feeling_morning: '',
  completed_am_habits: [],
};

export default function StartupPage() {
  const router = useRouter();
  const { userId, timezone, isInitializing, initError } = useInitializeSequence();
  const { yesterdayLog, loading: storeLoading, error: storeError } = useDailyLogStore();
  const supabase = createClientComponentClient<Database>(); // Initialize Supabase client

  const [formData, setFormData] = useState<StartupFormData>(initialFormData);
  const [currentStep, setCurrentStep] = useState<StartupSequence | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Determine if deferred confirmation is needed
  const showConfirmation = useMemo(
    () => !storeLoading && (yesterdayLog?.deferred_from_shutdown?.length ?? 0) > 0,
    [storeLoading, yesterdayLog]
  );

  // Build step order
  const stepOrder = useMemo(() => {
    const steps = [
      StartupSequence.PREV_EVENING_RATING,
      StartupSequence.SLEEP_RATING,
      StartupSequence.MORNING_RATING,
      StartupSequence.FEELING,
      StartupSequence.AM_HABITS,
    ];
    return showConfirmation
      ? [StartupSequence.CONFIRM_DEFERRED, ...steps]
      : steps;
  }, [showConfirmation]);

  // Initialize first step after ready
  useEffect(() => {
    if (!isInitializing) {
      const first = showConfirmation
        ? StartupSequence.CONFIRM_DEFERRED
        : StartupSequence.PREV_EVENING_RATING;
      setCurrentStep(first);
    }
  }, [isInitializing, showConfirmation]);

  // Navigate forward
  const submit = useCallback(
    async (data: StartupFormData) => {
      if (!userId) {
        setSubmitError('User not identified');
        return;
      }
      setIsSubmitting(true);
      setSubmitError(null);
      try {
        const logDate = getLocalDateString(timezone);
        const payload = stripUndefined({
          user_id: userId,
          log_date: logDate,
          prev_evening_rating: data.prev_evening_rating,
          sleep_rating: data.sleep_rating,
          morning_rating: data.morning_rating,
          feeling_morning: data.feeling_morning,
          completed_am_habits: data.completed_am_habits,
          startup_completed_at: new Date().toISOString(),
        });
        const { error } = await supabase
          .from('daily_logs')
          .upsert(payload, { onConflict: 'user_id, log_date' });
        if (error) throw error;
        router.push('/dashboard?startup=complete');
      } catch (e: unknown) {
        setSubmitError(e instanceof Error ? e.message : String(e));
      } finally {
        setIsSubmitting(false);
      }
    },
    [userId, timezone, router, supabase, setSubmitError, setIsSubmitting]
  );

  const handleNext = useCallback(
    (stepData?: Partial<StartupFormData>) => {
      if (stepData) setFormData((prev) => ({ ...prev, ...stepData }));
      if (!currentStep) return;
      const idx = stepOrder.indexOf(currentStep);
      if (idx + 1 < stepOrder.length) {
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
    if (idx > 0) {
      setCurrentStep(stepOrder[idx - 1]);
    } else {
      router.push('/dashboard');
    }
  }, [currentStep, stepOrder, router]);

  // Render states
  if (initError) return <ErrorBanner message={initError} />;
  if (storeError) return <ErrorBanner message={storeError} />;
  if (isInitializing || storeLoading || !currentStep) return <LoadingOverlay />;

  return (
    <div className="max-w-2xl mx-auto p-4">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Morning Startup</h1>
        {!isSubmitting && (
          <Link href="/dashboard" className="text-indigo-600">
            Cancel
          </Link>
        )}
      </header>

      {submitError && <ErrorBanner message={submitError} />}

      <div className="relative bg-white shadow rounded-lg p-6 min-h-[300px]">
        {currentStep === StartupSequence.CONFIRM_DEFERRED && (
          <ConfirmDeferredShutdownHabitsStep onNext={handleNext} onBack={handleBack} />
        )}
        {currentStep === StartupSequence.PREV_EVENING_RATING && (
          <PrevEveningRatingStep
            initialValue={formData.prev_evening_rating}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}
        {currentStep === StartupSequence.SLEEP_RATING && (
          <SleepRatingStep
            initialValue={formData.sleep_rating}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}
        {currentStep === StartupSequence.MORNING_RATING && (
          <MorningRatingStep
            initialValue={formData.morning_rating}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}
        {currentStep === StartupSequence.FEELING && (
          <FeelingStep
            initialValue={formData.feeling_morning}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}
        {currentStep === StartupSequence.AM_HABITS && (
          <AmHabitsStep
            initialValue={formData.completed_am_habits}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}

        {isSubmitting && <LoadingOverlay overlay />}
      </div>
    </div>
  );
}