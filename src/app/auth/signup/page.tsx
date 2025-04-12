'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client'; // Ensure this path is correct
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignUp() {
  // State variables for form inputs, loading status, and error messages
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState(''); // NEW: State for confirm password
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Handles the form submission for signing up
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent default browser form submission
    setError(null); // Clear previous errors first

    // --- NEW: Password Match Validation ---
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please try again.');
      // Note: Don't set loading true if validation fails immediately
      return; // Stop the function execution
    }
    // --- End Password Match Validation ---

    setLoading(true); // Set loading true only after validation passes

    try {
      // Attempt to sign up the user with Supabase Auth
      // Email confirmation is disabled (based on previous step)
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password, // Only the first password is sent to Supabase
      });

      // If Supabase returns an error object, throw it to be handled by the catch block
      if (signUpError) {
        throw signUpError;
      }

      // If sign up is successful AND we get a session (email confirm OFF)
      // Redirect the user to the dashboard immediately.
      if (data.user && data.session) {
         router.push('/dashboard'); // Redirect to the main dashboard
      } else {
         // This case indicates something unexpected happened
         console.error("Sign up response missing user or session:", data);
         throw new Error('Sign up succeeded but user/session data is missing.');
      }

    } catch (error: any) {
      // --- ERROR PATH ---
      console.error("Sign up error details:", error); // Log the full error for debugging

      // Check the error message for specific text indicating the user exists.
      if (error.message && (
            error.message.includes('User already registered') ||
            error.message.toLowerCase().includes('already exists') ||
            error.message.includes('duplicate key value violates unique constraint')
         )) {
         setError('This email address is already in use. Please try signing in.');
      } else {
         // For any other errors, display the message from Supabase or a generic fallback
         setError(error.message || 'An error occurred during sign up. Please try again.');
      }
    } finally {
      // Reset loading state regardless of success or failure
      setLoading(false);
    }
  };

  // Render the Sign Up form component
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-xl shadow-lg">
        {/* Header */}
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Welcome to Jo App
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Create your account to get started
          </p>
        </div>

        {/* Error Message Display */}
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
            <p className="font-bold">Error</p>
            <p>{error}</p>
          </div>
        )}

        {/* Sign Up Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSignUp}>
          <input type="hidden" name="remember" defaultValue="true" />
          {/* MODIFIED: Adjusted className structure for multiple inputs */}
          <div className="space-y-px rounded-md shadow-sm">
            {/* Email Input */}
            <div>
              <label htmlFor="email-address" className="sr-only">Email address</label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                // MODIFIED: Added rounded-t-md, removed rounded-b-md implicitly
                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            {/* Password Input */}
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                // MODIFIED: Removed rounding classes
                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Password (min. 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
             {/* NEW: Confirm Password Input */}
            <div>
              <label htmlFor="confirm-password" className="sr-only">Confirm Password</label>
              <input
                id="confirm-password"
                name="confirmPassword" // Use unique name if needed, but not critical here
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                // MODIFIED: Added rounded-b-md
                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={loading}
              className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                loading
                  ? 'bg-indigo-300 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
              }`}
            >
              {loading ? 'Signing up...' : 'Sign up'}
            </button>
          </div>

          {/* Link to Sign In */}
          <div className="text-sm text-center">
            <Link href="/auth/signin" className="font-medium text-indigo-600 hover:text-indigo-500">
              Already have an account? Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

