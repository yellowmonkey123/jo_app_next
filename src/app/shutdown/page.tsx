'use client';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShutdownFormData, ShutdownStep } from '@/types';
import { useDailyLogStore } from '@/stores/dailyLogStore';
import { useInitializeSequence } from '@/lib/hooks/useInitializeSequence';
import { getLocalDateString, stripUndefined } from '@/lib/utils/dateUtils';
import { getSupabaseClient } from '@/lib/supabase/supabaseClient';
import ConfirmDeferredStartupHabitsStep from '@/components/shutdown/ConfirmDeferredStartupHabitsStep';
import DayRatingStep from '@/components/shutdown/DayRatingStep';
import AccomplishmentStep from '@/components/shutdown/AccomplishmentStep';
import ImprovementStep from '@/components/shutdown/ImprovementStep';
import PmHabitsStep from '@/components/shutdown/PmHabitsStep';
import { LoadingOverlay } from '@/components/common/LoadingOverlay';
import ErrorBanner from '@/components/common/ErrorBanner';

// Sequence enum using existing ShutdownStep values
enum ShutdownSequence {
  CONFIRM_DEFERRED       = 'confirm-deferred',
  DAY_RATING             = ShutdownStep.DAY_RATING,
  ACCOMPLISHMENT         = ShutdownStep.ACCOMPLISHMENT,
  IMPROVEMENT            = ShutdownStep.IMPROVEMENT,
  PM_ANYTIME_HABITS      = ShutdownStep.PM_ANYTIME_HABITS,
}

const initialFormData: ShutdownFormData = {
  day_rating: null,
  accomplishment: '',
  improvement: '',
  completed_pm_anytime_habits: [],
};

export default function ShutdownPage() {
  const router = useRouter();
  const { userId, timezone, isInitializing, initError } = useInitializeSequence();
  const { todayLog, loading: storeLoading, error: storeError } = useDailyLogStore();

  const [formData, setFormData]       = useState<ShutdownFormData>(initialFormData);
  const [currentStep, setCurrentStep] = useState<ShutdownSequence | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError]   = useState<string | null>(null);

  // Determine if deferred confirmation is needed
  const showConfirmation = useMemo(
    () => !storeLoading && (todayLog?.deferred_from_startup?.length ?? 0) > 0,
    [storeLoading, todayLog]
  );

  // Build step order
  const stepOrder = useMemo(() => {
    const steps = [
      ShutdownSequence.DAY_RATING,
      ShutdownSequence.ACCOMPLISHMENT,
      ShutdownSequence.IMPROVEMENT,
      ShutdownSequence.PM_ANYTIME_HABITS,
    ];
    return showConfirmation ? [ShutdownSequence.CONFIRM_DEFERRED, ...steps] : steps;
  }, [showConfirmation]);

  // Initialize first step after ready
  useEffect(() => {
    if (!isInitializing) {
      const first = showConfirmation
        ? ShutdownSequence.CONFIRM_DEFERRED
        : ShutdownSequence.DAY_RATING;
      setCurrentStep(first);
    }
  }, [isInitializing, showConfirmation]);

  // Handle next step
  const submit = useCallback(
    async (data: ShutdownFormData) => {
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
          day_rating: data.day_rating,
          accomplishment: data.accomplishment,
          improvement: data.improvement,
          completed_pm_anytime_habits: data.completed_pm_anytime_habits,
          shutdown_completed_at: new Date().toISOString(),
        });
        const { error } = await supabase
          .from('daily_logs')
          .upsert(payload, { onConflict: 'user_id, log_date' });
        if (error) throw error;
        router.push('/dashboard?shutdown=complete');
      } catch (e: unknown) {
        setSubmitError(e instanceof Error ? e.message : String(e));
      } finally {
        setIsSubmitting(false);
      }
    },
    [userId, timezone, router, setSubmitError, setIsSubmitting], // Removed supabase
  );

  const handleNext = useCallback(
    (stepData?: Partial<ShutdownFormData>) => {
      if (stepData) setFormData((prev) => ({ ...prev, ...stepData }));
      if (!currentStep) return;
      const idx = stepOrder.indexOf(currentStep);
      if (idx + 1 < stepOrder.length) {
        setCurrentStep(stepOrder[idx + 1]);
      } else {
        submit({ ...formData, ...(stepData || {}) });
      }
    },
    [currentStep, stepOrder, formData, submit],
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
  if (initError)    return <ErrorBanner message={initError} />;
  if (storeError)   return <ErrorBanner message={storeError} />;
  if (isInitializing || storeLoading || !currentStep) return <LoadingOverlay />;

  return (
    <div className="max-w-2xl mx-auto p-4">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Evening Shutdown</h1>
        {!isSubmitting && <Link href="/dashboard" className="text-indigo-600">Cancel</Link>}
      </header>
      {submitError && <ErrorBanner message={submitError} />}
      <div className="relative bg-white shadow rounded-lg p-6 min-h-[300px]">
        {currentStep === ShutdownSequence.CONFIRM_DEFERRED && (
          <ConfirmDeferredStartupHabitsStep onNext={handleNext} onBack={handleBack} />
        )}
        {currentStep === ShutdownSequence.DAY_RATING && (
          <DayRatingStep initialValue={formData.day_rating} onNext={handleNext} onBack={handleBack} />
        )}
        {currentStep === ShutdownSequence.ACCOMPLISHMENT && (
          <AccomplishmentStep initialValue={formData.accomplishment} onNext={handleNext} onBack={handleBack} />
        )}
        {currentStep === ShutdownSequence.IMPROVEMENT && (
          <ImprovementStep initialValue={formData.improvement} onNext={handleNext} onBack={handleBack} />
        )}
        {currentStep === ShutdownSequence.PM_ANYTIME_HABITS && (
          <PmHabitsStep initialValue={formData.completed_pm_anytime_habits} onNext={handleNext} onBack={handleBack} />
        )}
        {isSubmitting && <LoadingOverlay overlay />}
      </div>
    </div>
  );
}
