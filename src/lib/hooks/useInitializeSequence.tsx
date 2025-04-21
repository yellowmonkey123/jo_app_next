// src/lib/hooks/useInitializeSequence.tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
// Import the function to get the Supabase client
import { getSupabaseClient } from '@/lib/supabase/supabaseClient';
// Import the Zustand store hook
import { useDailyLogStore } from '@/stores/dailyLogStore';

// Define the shape of the object returned by the hook
interface InitResult {
  userId: string | null; // User ID if authenticated, null otherwise
  timezone: string; // User's timezone (defaults to UTC)
  isInitializing: boolean; // True while fetching auth/profile/logs
  initError: string | null; // Error message if initialization fails
}

/**
 * Custom hook to handle the initial sequence of fetching user authentication,
 * profile (for timezone), and triggering the initial log fetch.
 * Returns necessary state for sequence components.
 */
export function useInitializeSequence(): InitResult {
  const router = useRouter(); // Using router for potential redirects (though not currently used here)
  // State variables managed by this hook
  const [userId, setUserId] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string>('UTC'); // Default timezone
  const [isInitializing, setIsInitializing] = useState(true); // Start in initializing state
  const [initError, setInitError] = useState<string | null>(null); // Store initialization errors

  // Get the fetchLogs action from the Zustand store
  const { fetchLogs } = useDailyLogStore();

  // useEffect runs once on component mount to perform initialization
  useEffect(() => {
    let active = true; // Flag to prevent state updates if the component unmounts during async operations

    // Define and immediately invoke an async function
    (async () => {
      console.log("useInitializeSequence: Starting initialization...");
      // Get Supabase client instance
      const supabase = getSupabaseClient();

      // --- Start Fix: Check if Supabase client initialized successfully ---
      if (!supabase) {
          console.error('useInitializeSequence: Supabase client is null. Check environment configuration.');
          if (active) { // Only update state if component is still mounted
             setInitError('Database connection failed. Please check setup.');
             setIsInitializing(false); // Stop initializing process
          }
          return; // Exit the async function
      }
      // --- End Fix ---
      console.log("useInitializeSequence: Supabase client validated.");

      try {
        // 1. Get current session/user
        console.log("useInitializeSequence: Fetching session...");
        // supabase is guaranteed non-null here
        const {
          data: { session },
          error: authError,
        } = await supabase.auth.getSession();

        // Handle authentication errors or missing session/user
        if (authError || !session?.user?.id) {
          console.error("useInitializeSequence: Auth error or no session/user.", authError);
          // Throw an error to be caught below
          throw authError || new Error('User not authenticated. Please sign in.');
        }
        // Check if component is still mounted before updating state
        if (!active) return;

        // 2. Set User ID
        const uId = session.user.id;
        console.log("useInitializeSequence: User authenticated:", uId);
        setUserId(uId);

        // 3. Fetch user's timezone from profile (defaulting to UTC)
        let tz = 'UTC'; // Default timezone
        try {
          console.log("useInitializeSequence: Fetching profile timezone for user:", uId);
          // supabase is guaranteed non-null here
          const { data: profileData, error: profileError } = await supabase
            .from('profiles') // Target 'profiles' table
            .select('timezone') // Select only the timezone column
            .eq('id', uId) // Match the user ID
            .single(); // Expect one row or null

          // Handle profile fetch errors (optional, defaults to UTC)
          if (profileError && profileError.code !== 'PGRST116') { // Ignore 'resource not found' error
             console.warn("useInitializeSequence: Error fetching profile timezone:", profileError.message, "(Using default UTC)");
          } else if (profileData?.timezone) {
             // If profile and timezone exist, use it
             tz = profileData.timezone;
             console.log("useInitializeSequence: Found timezone in profile:", tz);
          } else {
             console.log("useInitializeSequence: No timezone found in profile, using default UTC.");
          }
        } catch (profileCatchError) {
          // Catch unexpected errors during profile fetch (optional, defaults to UTC)
          console.warn("useInitializeSequence: Unexpected error fetching profile timezone:", profileCatchError, "(Using default UTC)");
        }
        // Check if component is still mounted before updating state
        if (!active) return;
        setTimezone(tz); // Set the determined timezone

        // 4. Trigger initial fetch of logs using the determined user ID and timezone
        console.log("useInitializeSequence: Triggering initial log fetch for user:", uId, "timezone:", tz);
        await fetchLogs(uId, tz); // Call action from Zustand store
        console.log("useInitializeSequence: Initial log fetch triggered.");

      } catch (e: unknown) {
        // Catch errors from auth, profile fetch, or log fetch trigger
        console.error('useInitializeSequence: Error during initialization process:', e);
        if (active) { // Only update state if component is still mounted
            setInitError(e instanceof Error ? e.message : 'An unexpected error occurred during initialization.');
            setUserId(null); // Ensure user ID is null on error
            setTimezone('UTC'); // Reset timezone to default on error
        }
      } finally {
        // Ensure initialization state is set to false regardless of success/error
        if (active) { // Only update state if component is still mounted
            setIsInitializing(false);
            console.log("useInitializeSequence: Initialization finished.");
        }
      }
    })(); // Immediately invoke the async function

    // Cleanup function for useEffect
    return () => {
      console.log("useInitializeSequence: Cleanup - component unmounted or dependencies changed.");
      active = false; // Set flag to false to prevent state updates after unmount
    };
  // Dependencies for useEffect: Re-run if router or fetchLogs function reference changes
  // Typically, fetchLogs from Zustand is stable, router might change in some scenarios.
  }, [router, fetchLogs]);

  // Return the state values needed by components using this hook
  return {
    userId,
    timezone,
    isInitializing,
    initError,
  };
}