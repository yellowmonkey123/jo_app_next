import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useDailyLogStore } from '@/stores/dailyLogStore';

interface InitResult {
  userId: string | null;
  timezone: string;
  isInitializing: boolean;
  initError: string | null;
}

/**
 * Hook to perform common initialization: auth check, timezone fetch, and log loading.
 */
export function useInitializeSequence(): InitResult {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string>('UTC');
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  const { fetchLogs } = useDailyLogStore();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // 1. Auth check
        const {
          data: { session },
          error: authError,
        } = await supabase.auth.getSession();
        if (authError || !session?.user?.id) {
          throw authError || new Error('Unauthenticated');
        }
        if (!active) return;
        const uId = session.user.id;
        setUserId(uId);

        // 2. Fetch profile timezone
        let tz = 'UTC';
        try {
          const { data, error: pErr } = await supabase
            .from('profiles')
            .select('timezone')
            .eq('id', uId)
            .single();
          if (!pErr && data?.timezone) tz = data.timezone;
        } catch {
          // ignore and use default UTC
        }
        if (!active) return;
        setTimezone(tz);

        // 3. Load logs via Zustand
        await fetchLogs(uId, tz);
      } catch (e: unknown) {
        console.error('useInitializeSequence error:', e);
        if (active) setInitError(e instanceof Error ? e.message : String(e));
      } finally {
        if (active) setIsInitializing(false);
      }
    })();
    return () => { active = false; };
  }, [router, fetchLogs]);

  return {
    userId,
    timezone,
    isInitializing,
    initError,
  };
}
