'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
// Import the function to get the Supabase client
import { getSupabaseClient } from '@/lib/supabase/supabaseClient';
// Assuming User type is correctly defined in '@/types'
import type { User } from '@/types'; // Keep this if User type from Supabase Auth is used
// Import Supabase auth event/session types
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

export default function Header() {
  const router = useRouter();
  // State for the authenticated user object
  const [user, setUser] = useState<User | null>(null); // Use local User type here
  // State for tracking authentication loading status
  const [loadingAuth, setLoadingAuth] = useState(true);
  // State for dropdown menu visibility
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  // Refs for dropdown and trigger button to handle outside clicks
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Initialize Supabase client once using useState
  const [supabase] = useState(() => getSupabaseClient());

  // Effect hook for fetching initial user state and setting up auth listener
  useEffect(() => {
    // Check if Supabase client is available before proceeding
    if (!supabase) {
        console.error("Header: Supabase client not available on mount. Cannot check auth state.");
        setLoadingAuth(false); // Stop loading, potentially show logged-out state
        return; // Exit effect early
    }
    console.log("Header: Supabase client available.");

    // Function to fetch the initial user
    const getUser = async () => {
      console.log("Header: Attempting to fetch initial user...");
      // Keep loading true until listener provides initial state or fetch completes
      // setLoadingAuth(true); // Indicate loading - Moved initial setLoading to true state declaration
      try {
        // supabase is guaranteed non-null here due to the check above
        const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();

        // This initial fetch might be redundant if onAuthStateChange fires quickly,
        // but it helps ensure state is set on initial load if the listener is delayed.
        // The listener will overwrite this state if needed.

        if (authError) {
            // Don't set error state here, let onAuthStateChange handle state
            console.error("Header: Error fetching initial user (might be normal if not logged in):", authError.message);
            // setUser(null); // Let listener handle setting null
        } else {
            console.log("Header: Initial user fetched:", currentUser?.id ?? 'None');
            // Set user state - currentUser might be null if not logged in
            // Cast needed if local User type differs slightly from Supabase User type
            setUser(currentUser as User | null);
        }
      } catch (err) {
          console.error("Header: Unexpected error during initial user fetch:", err);
          setUser(null); // Assume logged out on unexpected error
      } finally {
          // Set loading false ONLY IF the auth listener hasn't already fired
          // The listener below also sets loading false, which is usually sufficient
          // setLoadingAuth(false);
      }
    };

    // Call the function to get the initial user state
    getUser();

    // Set up Auth State Change Listener
    console.log("Header: Setting up auth state change listener.");
    // supabase is guaranteed non-null here
    const { data: authListener } = supabase.auth.onAuthStateChange(
      // Add explicit types for event and session
      (event: AuthChangeEvent, session: Session | null) => {
        console.log("Header: Auth state changed:", event, "Session:", session ? `User ${session.user.id}` : 'Null');
        // Update user state based on the session user
        // Cast needed if local User type differs slightly from Supabase User type
        setUser(session?.user as User | null ?? null); // Use nullish coalescing
        setLoadingAuth(false); // Stop loading once auth state is determined by listener
        // Close dropdown if user signs out
        if (event === 'SIGNED_OUT') {
          setIsDropdownOpen(false);
        }
      }
    );

    // Cleanup function for the effect
    return () => {
      // Unsubscribe from the auth listener when the component unmounts
      if (authListener?.subscription) {
          console.log("Header: Unsubscribing from auth state changes.");
          authListener.subscription.unsubscribe();
      }
    };
  // Dependency array includes supabase instance
  }, [supabase]);

  // Effect hook to handle clicks outside the dropdown menu to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if the click is outside the dropdown and the trigger button
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false); // Close dropdown
      }
    };

    // Add listener only when the dropdown is open
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      // Remove listener when closed or component unmounts
      document.removeEventListener('mousedown', handleClickOutside);
    }

    // Cleanup function to remove listener on unmount or when dropdown closes
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]); // Re-run effect when dropdown visibility changes

  // Handler for the sign-out action
  const handleSignOut = async () => {
    setIsDropdownOpen(false); // Close dropdown first

    // Check if Supabase client is available
    if (!supabase) {
        console.error('Header: Supabase client not available. Cannot sign out.');
        // Optionally show an error message to the user
        return;
    }
    console.log("Header: Attempting sign out...");

    // Call Supabase sign out function
    const { error } = await supabase.auth.signOut();

    // Handle potential sign-out errors
    if (error) {
      console.error('Header: Error signing out:', error);
      // Optionally show an error message to the user
    } else {
      console.log("Header: Sign out successful.");
      // User state will be updated by the onAuthStateChange listener,
      // but redirect immediately.
      router.replace('/auth/signin'); // Use replace to avoid back button going to authenticated state
    }
  };

  // --- Render Logic ---

  // Render a placeholder or minimal header while auth state is loading initially
  if (loadingAuth) {
    return (
        <header className="bg-white shadow-sm h-[61px]">
             <nav className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
                {/* Basic Logo Placeholder */}
                <span className="text-xl font-bold text-indigo-600">Jo App</span>
                {/* Loading indicator placeholder */}
                <div className="h-8 w-20 bg-gray-200 rounded animate-pulse"></div>
             </nav>
        </header>
    );
  }

  // Main header render
  return (
    <header className="bg-white shadow-sm">
      <nav className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Top">
        <div className="w-full py-3 flex items-center justify-between">
          {/* Logo / Home Link */}
          <div className="flex items-center">
            <Link href={user ? "/dashboard" : "/"} className="text-xl font-bold text-indigo-600 hover:text-indigo-800">
              Jo App
            </Link>
          </div>
          {/* Right side: User Menu or Sign In Link */}
          <div className="ml-10 relative">
            {user ? (
              // --- User is logged in: Display dropdown menu ---
              <div>
                {/* Dropdown Trigger Button (User Icon) */}
                <button
                  ref={triggerRef} // Ref for outside click detection
                  type="button"
                  className="bg-white rounded-full flex text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  id="user-menu-button"
                  aria-expanded={isDropdownOpen}
                  aria-haspopup="true"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)} // Toggle dropdown
                >
                  <span className="sr-only">Open user menu</span>
                  {/* Basic User Icon */}
                  <svg className="h-8 w-8 rounded-full text-gray-400 border border-gray-300 hover:text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </button>
                {/* Dropdown Menu Panel */}
                {isDropdownOpen && (
                  <div
                    ref={dropdownRef} // Ref for outside click detection
                    className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby="user-menu-button"
                    tabIndex={-1} // Allows focus management
                  >
                    {/* Settings Link */}
                    <Link
                      href="/settings"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      role="menuitem"
                      tabIndex={-1}
                      id="user-menu-item-0"
                      onClick={() => setIsDropdownOpen(false)} // Close dropdown on click
                    >
                      Profile Settings
                    </Link>
                    {/* Sign Out Button */}
                    <button
                      onClick={handleSignOut}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      role="menuitem"
                      tabIndex={-1}
                      id="user-menu-item-1"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              // --- User is logged out: Display Sign In link ---
              <Link href="/auth/signin" className="text-base font-medium text-gray-500 hover:text-gray-900">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}