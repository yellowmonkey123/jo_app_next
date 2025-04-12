'use client'; // This component needs client-side interaction

import { useState, useEffect, useRef } from 'react'; // Import hooks
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client'; // Use client instance
import type { User } from '@supabase/supabase-js'; // Import User type

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true); // Renamed loading state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false); // State for dropdown visibility
  const dropdownRef = useRef<HTMLDivElement>(null); // Ref for click-outside detection
  const triggerRef = useRef<HTMLButtonElement>(null); // Ref for the trigger button

  // Check auth state on component mount and on auth changes
  useEffect(() => {
    const getUser = async () => {
      setLoadingAuth(true); // Start loading
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
      setLoadingAuth(false); // Finish loading
    };
    getUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoadingAuth(false); // Update loading state on change too
      // Close dropdown on sign out
      if (event === 'SIGNED_OUT') {
         setIsDropdownOpen(false);
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  // Effect to handle clicks outside the dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close if clicked outside dropdown and not on the trigger button
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    // Add listener if dropdown is open
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    // Cleanup listener on component unmount or when dropdown closes
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]); // Re-run when dropdown state changes


  const handleSignOut = async () => {
    setIsDropdownOpen(false); // Close dropdown first
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
    } else {
      setUser(null); // Optimistically clear user state
      router.replace('/auth/signin');
    }
  };

  // Render nothing during initial auth check to prevent flicker
  if (loadingAuth) {
    // Return a placeholder with the same height as the header
    return <header className="bg-white shadow-sm h-[61px]"></header>; // Adjust height if needed
  }

  return (
    <header className="bg-white shadow-sm">
      <nav className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Top">
        <div className="w-full py-3 flex items-center justify-between"> {/* Removed border */}
          <div className="flex items-center">
            <Link href={user ? "/dashboard" : "/"} className="text-xl font-bold text-indigo-600 hover:text-indigo-800">
              Jo App
            </Link>
            {/* Optional: Add other nav links here */}
          </div>
          <div className="ml-10 relative"> {/* Changed wrapper for relative positioning */}
            {/* Render based on user auth state */}
            {user ? (
              // --- Dropdown Trigger ---
              <div>
                <button
                  ref={triggerRef} // Add ref to trigger button
                  type="button"
                  className="bg-white rounded-full flex text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  id="user-menu-button"
                  aria-expanded={isDropdownOpen}
                  aria-haspopup="true"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)} // Toggle dropdown
                >
                  <span className="sr-only">Open user menu</span>
                  {/* Simple SVG User Icon Placeholder */}
                  <svg className="h-8 w-8 rounded-full text-gray-400 border border-gray-300" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  {/* TODO: Replace with actual user avatar if available */}
                </button>

                {/* --- Dropdown Menu --- */}
                {isDropdownOpen && (
                  <div
                    ref={dropdownRef} // Add ref to dropdown menu
                    className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50" // Added z-index
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby="user-menu-button"
                    tabIndex={-1}
                  >
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
              // --- Show Sign In link if not logged in ---
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
