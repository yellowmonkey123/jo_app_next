// src/lib/supabase/serverClient.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
// Removed problematic type import: import type { ReadonlyRequestCookies } from 'next/headers';
// Assuming Database type is correctly generated/defined
import type { Database } from '@/types/supabase';

/**
 * Creates a Supabase client instance specifically for server-side usage
 * (Server Components, Route Handlers, Server Actions) within Next.js App Router.
 * It reads cookies using the 'next/headers' module.
 *
 * @returns A Supabase client instance configured for server-side operations.
 * @throws Error if required environment variables (URL/Anon Key) are missing.
 */
export function getServerSupabase() {
  // Get the cookie store instance from next/headers.
  // This should be synchronous in the correct server-side context.
  // Reverted to implicit typing as explicit import failed
  const cookieStore = cookies();

  // Ensure required environment variables are set
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Throw a clear error if configuration is missing
    throw new Error('Missing Supabase URL or Anon Key in environment variables.');
  }

  // Create and return the server-side Supabase client
  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        /**
         * Retrieves a cookie value by name.
         * Required by @supabase/ssr to read auth tokens.
         * @param name - The name of the cookie to retrieve.
         * @returns The cookie value or undefined if not found.
         */
        get(name: string): string | undefined {
          // Use the synchronous get method from the cookie store
          const cookie = cookieStore.get(name);
          return cookie?.value;
        },
        /**
         * Sets a cookie value.
         * Required by @supabase/ssr to persist auth tokens.
         * NOTE: This server client setup is primarily for READING cookies
         * on the server. To SET cookies, you typically need a Server Action
         * or Route Handler context where you can call cookieStore.set().
         * The createServerClient needs these methods defined, but the 'set'
         * and 'remove' might not be directly callable via this specific instance
         * depending on where getServerSupabase() is invoked.
         * For auth operations that set cookies (signIn, signOut), use the client
         * within Server Actions or Route Handlers.
         */
        set(name: string, value: string, options: CookieOptions): void {
           try {
               // This will likely only work correctly within a Server Action or Route Handler
               cookieStore.set(name, value, options);
           } catch (error) {
               // Log error if setting fails (e.g., called in a context where set is not allowed)
               console.error(`Error setting cookie '${name}' in server client:`, error);
               // Depending on your use case, you might ignore this error if this client
               // is only ever used for reading, or re-throw if setting is critical.
           }
        },
        /**
         * Removes a cookie.
         * Required by @supabase/ssr for operations like signOut.
         * Similar context limitations as the 'set' method apply.
         */
        remove(name: string, options: CookieOptions): void {
           try {
               // This will likely only work correctly within a Server Action or Route Handler
               cookieStore.set(name, '', options); // Setting empty value with options (like expires) effectively removes it
           } catch (error) {
                // Log error if removing fails
               console.error(`Error removing cookie '${name}' in server client:`, error);
           }
        }
      },
    }
  );
}