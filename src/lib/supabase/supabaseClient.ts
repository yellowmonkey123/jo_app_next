// src/lib/supabase/supabaseClient.ts

// --- FIX: Import createBrowserClient from @supabase/ssr ---
import { createBrowserClient } from '@supabase/ssr';
// --- FIX: Import the SupabaseClient type from @supabase/supabase-js ---
import { type SupabaseClient } from '@supabase/supabase-js';
// Assuming Database type is correctly generated/defined in '@/types/supabase'
import type { Database } from '@/types/supabase';

// Read environment variables (ensure these are prefixed for browser access, e.g., NEXT_PUBLIC_)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Validate environment variables on module load.
if (!SUPABASE_URL) {
  throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
}
if (!SUPABASE_ANON_KEY) {
  throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// Removed custom cookieStorage adapter as createBrowserClient handles cookies.

// Declare supabaseClient variable to hold the singleton instance.
// Use the explicit type matching what createBrowserClient returns.
let supabaseClient: SupabaseClient<Database, 'public'> | null = null;

/**
 * Gets the singleton Supabase client instance optimized for browser usage
 * within a Next.js App Router app using SSR/server components.
 * Initializes the client on first call using createBrowserClient from @supabase/ssr.
 * Handles cookie-based auth persistence automatically.
 *
 * @returns {SupabaseClient<Database, 'public'>} The Supabase browser client instance.
 * @throws Error if Supabase environment variables are missing or client fails init.
 */
export function getSupabaseClient(): SupabaseClient<Database, 'public'> {
  // Initialize client only if it doesn't exist yet (singleton pattern)
  if (!supabaseClient) {
    console.log("Initializing Supabase client (browser - SSR)...");
    try {
      // Use createBrowserClient from @supabase/ssr
      supabaseClient = createBrowserClient<Database>(
        // Non-null assertion safe due to checks above
        SUPABASE_URL!,
        SUPABASE_ANON_KEY!,
        {
          // Optional: Configure auth options if needed (defaults are usually fine)
          auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true, // Default is true
          },
        }
      // Type assertion may not be needed now imports are correct, but kept for safety
      ) as SupabaseClient<Database, 'public'>;
      console.log("Supabase browser client initialized successfully.");
    } catch (error) {
        // Catch potential errors during client creation itself
        console.error("Error creating Supabase browser client:", error);
        // Re-throw or handle appropriately
        throw new Error(`Failed to initialize Supabase client: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // If supabaseClient is still null after attempting initialization (should be unreachable)
  if (!supabaseClient) {
     console.error("Supabase client is null after initialization attempt.");
     throw new Error("Failed to get Supabase client instance.");
  }

  // Return the initialized client instance
  return supabaseClient;
}