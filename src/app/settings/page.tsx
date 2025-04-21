'use client';
import { useEffect, useState, useCallback, ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabase/supabaseClient';
// Ensure this User type matches your definition in '@/types/index.ts'
// Expected: { id: string; email: string; created_at: string; ... possibly other fields }
import type { User } from '@/types';

// Define the Profile type based on your schema including the new timezone field
// Ensure this matches your 'profiles' table structure
type Profile = {
    id: string; // UUID, matches auth.users.id
    updated_at: string | null;
    display_name: string | null;
    phone: string | null;
    avatar_url: string | null;
    enable_sms_notifications: boolean;
    timezone: string | null; // Ensure 'timezone' column exists in your 'profiles' table
};

// Sample list of IANA Timezones (Consider fetching this dynamically or expanding)
const timezones = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Australia/Sydney',
    // Add more as needed
];

export default function SettingsPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  // State for the user object, conforming to the local User type
  const [user, setUser] = useState<User | null>(null);
  // State for the user's profile data
  const [profile, setProfile] = useState<Profile | null>(null);
  // State for form inputs
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [smsEnabled, setSmsEnabled] = useState<boolean>(false);
  const [timezone, setTimezone] = useState<string>('UTC'); // Default timezone
  // State for UI feedback
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false); // For disabling buttons during actions

  // Fetch user and profile data using useCallback to memoize the function
  const fetchData = useCallback(async () => {
    console.log('SettingsPage: Starting fetchData...');
    setLoading(true);
    setError(null); // Clear previous errors/messages
    setMessage(null);
    // Reset potentially stale data
    setProfile(null);
    setPhoneNumber('');
    setSmsEnabled(false);
    setTimezone('UTC'); // Reset timezone to default

    // Ensure Supabase client is available
    if (!supabase) {
      console.error('Supabase client not initialized. Check environment configuration.');
      setError('Supabase client not initialized. Please check environment configuration.');
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch Supabase Auth User
      // currentUser here has the type defined by @supabase/auth-js
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();

      // Handle potential errors during user fetching
      if (userError) {
          console.error("SettingsPage: Error fetching auth user:", userError);
          throw userError; // Throw error to be caught by the catch block
      }

      // Handle case where no user is logged in
      if (!currentUser) {
        console.log('SettingsPage: No user found, redirecting to signin.');
        router.push('/auth/signin'); // Redirect to login page
        // No need to setLoading(false) here, as the redirect will unmount the component
        return; // Stop execution
      }

      console.log('SettingsPage: Raw Supabase Auth User fetched:', currentUser.id, currentUser.email);

      // --- Start Modification: Adapt Supabase Auth user to local User type ---

      // Validate that the fetched user data meets the requirements of the local User type.
      // Your local User type (from @/types) requires: id: string, email: string, created_at: string.
      if (typeof currentUser.email !== 'string' || !currentUser.email) {
          console.error('SettingsPage: User object from Supabase is missing a valid email address.', currentUser);
          // Throwing an error prevents proceeding with incomplete essential data.
          throw new Error('User authentication data is incomplete (missing email). Cannot load settings.');
      }
      // Also validate created_at as per your local User type definition
      if (typeof currentUser.created_at !== 'string' || !currentUser.created_at) {
          console.error('SettingsPage: User object from Supabase is missing a valid created_at timestamp.', currentUser);
           // Decide how critical created_at is. Throwing is safest if it's needed.
          throw new Error('User authentication data is incomplete (missing created_at). Cannot load settings.');
      }

      // Create a new object 'appUser' that strictly conforms to your local User type definition (@/types).
      // This ensures type safety when setting the React state.
      const appUser: User = {
        id: currentUser.id,
        email: currentUser.email, // Validated non-empty string
        created_at: currentUser.created_at, // Validated non-empty string
        // Add any other properties if your local User type had more required fields, mapping from currentUser
        // e.g., some_other_field: currentUser.some_other_field ?? defaultValue,
      };

      // Set the user state using the validated and correctly typed appUser object
      setUser(appUser);
      console.log('SettingsPage: Local User state set:', appUser.id);

      // --- End Modification ---


      // 2. Fetch Profile using the validated user ID (includes timezone)
      // Use appUser.id (which is the same as currentUser.id)
      console.log('SettingsPage: Fetching profile for user:', appUser.id);
      const { data: profileData, error: profileError } = await supabase
        .from('profiles') // Ensure 'profiles' table exists
        .select('*')
        .eq('id', appUser.id) // Use the validated user's ID
        .single(); // Expects one row or zero rows (throws error if multiple)

      // Handle profile fetching results
      if (profileError) {
        // Specific handling for profile not found (PGRST116: PostgREST 'resource not found')
        if (profileError.code === 'PGRST116') {
          console.warn('SettingsPage: Profile row not found for this user.', profileError);
          // Set error message for user, but don't necessarily block the page
          setError('Profile data not found. You may need to create your profile.');
          setProfile(null); // Ensure profile state is null
        } else {
          // Rethrow other profile errors to be caught by the main catch block
          console.error("SettingsPage: Error fetching profile:", profileError);
          throw profileError;
        }
      } else if (profileData) {
        // Profile found, update state
        console.log('SettingsPage: Profile fetched successfully:', profileData);
        // Cast to Profile type (ensure Profile type definition matches table)
        setProfile(profileData as Profile);
        // Populate form fields from profile data, providing defaults
        setPhoneNumber(profileData.phone || '');
        setSmsEnabled(profileData.enable_sms_notifications || false);
        setTimezone(profileData.timezone || 'UTC'); // Use profile timezone or default
      } else {
         // Handle unexpected case where no data and no error (shouldn't happen with .single())
         console.warn('SettingsPage: Profile data was null/undefined but no error was thrown.');
         setError('Profile data not found.');
         setProfile(null);
      }

    } catch (err: unknown) {
      // Catch errors from auth user fetch, profile fetch, or validation
      console.error('SettingsPage: Error during data fetching process:', err);
      let errorMessage = 'Failed to load settings data. Please try refreshing.';
      // Provide more specific error messages if possible
      if (err instanceof Error) {
          // Check for common Supabase/DB errors
          if (err.message.includes('column profiles.timezone does not exist')) {
            errorMessage = 'Database error: "timezone" column not found in "profiles" table. Please run the database migration.';
          } else if (err.message.includes('relation "public.profiles" does not exist')) {
            errorMessage = 'Database error: Profiles table not found. Ensure migrations are run.';
          } else if (err.message.includes('permission denied')) {
            errorMessage = 'Permission denied. Please check database permissions (RLS policies and Grants).';
          } else {
            // Use the specific error message from the thrown error
            errorMessage = err.message;
          }
      }
      setError(errorMessage);
      setUser(null); // Clear potentially incomplete state
      setProfile(null);
      // Reset form fields on error
      setPhoneNumber('');
      setSmsEnabled(false);
      setTimezone('UTC');
    } finally {
      // Ensure loading indicator is turned off regardless of success or failure
      setLoading(false);
      console.log('SettingsPage: fetchData finished.');
    }
  // Dependencies for useCallback: re-run only if router or supabase instance changes
  }, [router, supabase]);

  // useEffect hook to run fetchData when the component mounts or dependencies change
  useEffect(() => {
    fetchData();
  }, [fetchData]); // Dependency array includes the memoized fetchData function

  // --- Action Handlers ---

  // Handler for password reset request
  const handlePasswordReset = async () => {
    // Use optional chaining on the user state
    if (!user?.email) {
      setError('Could not find user\'s email address to send reset link.');
      return;
    }
    if (!supabase) {
      setError('Supabase client not available.');
      return;
    }

    setIsProcessing(true); // Indicate processing started
    setError(null); // Clear previous errors/messages
    setMessage(null);

    try {
      // Call Supabase password reset function
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          user.email,
          { redirectTo: window.location.origin + '/auth/update-password' } // Optional: URL to redirect after password reset
      );
      if (resetError) {
          console.error('Password Reset Error:', resetError);
          throw resetError; // Throw error to be caught below
      }
      setMessage('Password reset email sent. Please check your inbox (and spam folder).');
    } catch (err: unknown) {
      console.error('Password Reset Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send password reset email.');
    } finally {
      setIsProcessing(false); // Indicate processing finished
    }
  };

  // Handler for updating user profile information
  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault(); // Prevent default form submission

    // Ensure user and profile data are loaded before attempting update
    if (!user) { // Profile might be null if not found, but user must exist
      setError('User data not loaded, cannot update profile.');
      return;
    }
     if (!supabase) {
      setError('Supabase client not available.');
      return;
    }

    setIsProcessing(true); // Indicate processing started
    setError(null); // Clear previous errors/messages
    setMessage(null);

    console.log('SettingsPage: Attempting to update profile for user:', user.id, 'with phone:', phoneNumber, 'SMS enabled:', smsEnabled, 'Timezone:', timezone);

    // Prepare the data object for the update
    const updates = {
      // id: user.id, // ID is used in .eq(), not usually needed in update payload itself
      phone: phoneNumber.trim() === '' ? null : phoneNumber.trim(), // Set phone to null if empty string
      enable_sms_notifications: smsEnabled,
      timezone: timezone, // Update timezone
      updated_at: new Date().toISOString(), // Set timestamp for the update
      // Include other profile fields if they are editable here
      // display_name: displayNameState, // Example if display name was editable
    };

    try {
      // Perform the update operation on the 'profiles' table
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id); // Ensure update targets the correct user

      if (updateError) {
          console.error('Profile Update Error:', updateError);
          // Check for specific RLS errors
          if (updateError.message.includes('violates row-level security policy')) {
            setError('Update failed: Permission denied. Please check application setup (RLS policies).');
          } else {
            // Throw other errors to be caught below
            throw updateError;
          }
      } else {
        // Update successful
        console.log('SettingsPage: Profile updated successfully.');
        setMessage('Profile updated successfully!');
        // Optimistically update the local profile state to reflect changes immediately
        // Ensure the update payload structure matches the Profile type
        setProfile(prevProfile => ({
            ...(prevProfile ?? { id: user.id, avatar_url: null, display_name: null }), // Provide defaults if profile was null
            ...updates, // Spread the updates
            id: user.id, // Ensure ID remains
        }));
      }
    } catch (err: unknown) {
      console.error('Profile Update Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setIsProcessing(false); // Indicate processing finished
    }
  };

  // Placeholder handler for account deletion
  const handleDeleteAccount = async () => {
    // Basic checks
    if (!user) return;
    if (!supabase) {
      setError('Supabase client not available.');
      return;
    }

    // Confirmation dialog
    if (!window.confirm('Are you absolutely sure you want to delete your account? This action cannot be undone and all your data (logs, habits, etc.) will be permanently lost.')) {
      return; // User cancelled
    }

    setIsProcessing(true); // Indicate processing started
    setError(null); // Clear previous errors/messages
    setMessage(null);

    // --- IMPORTANT ---
    // Account deletion should typically be handled by a secure backend function (e.g., Supabase Edge Function)
    // that verifies ownership and cascades deletes correctly. Directly calling delete from the client is insecure.
    console.warn('Account deletion initiated - Placeholder logic. Requires secure backend implementation (e.g., Supabase Function).');
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsProcessing(false); // Indicate processing finished (placeholder)
    // Provide feedback - this should ideally come from the backend function result
    setError('Account deletion requires backend setup for security. This is a placeholder.');
    // On successful deletion from backend, you would typically sign the user out and redirect:
    // await supabase.auth.signOut();
    // router.push('/');
  };


  // --- Render Logic ---

  // Loading state display
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        {/* Simple loading spinner */}
        <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        <span className="ml-2 text-gray-700">Loading settings...</span>
      </div>
    );
  }

  // Error state display (when data loading failed critically)
  // Show this specific error view only if essential data (user) failed to load
  if (error && !user) {
    return (
      <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-4" role="alert">
          <strong className="font-bold">Error Loading Settings: </strong>
          <span className="block sm:inline">{error}</span>
          <p className="text-sm mt-1">Please try refreshing the page. If the problem persists, contact support.</p>
        </div>
        {/* Provide a way back if possible */}
        <div className="mt-4">
            <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline">← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

   // Handle case where user is loaded but profile might still be loading or failed (non-critical error handled inline)
   // Or if user somehow loaded but profile didn't trigger the specific error above
   if (!user) {
     // This case should ideally be covered by the loading state or the error state above,
     // but acts as a fallback. Could indicate a logic issue if reached often.
     return (
        <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
            <p>Loading user data...</p>
             <div className="mt-4">
                <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline">← Back to Dashboard</Link>
            </div>
        </div>
     );
   }


  // Main settings page content (rendered when user is loaded)
  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 font-sans">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Settings</h1>
        <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline">← Back to Dashboard</Link>
      </div>

      {/* Display Success Messages */}
      {message && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg relative mb-4" role="alert">
            <p>{message}</p>
        </div>
      )}
      {/* Display Non-critical Errors (e.g., profile update failed, but page still usable) */}
      {error && !message && ( // Show error only if there's no success message
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-4" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
        </div>
      )}

      {/* Profile Information Form */}
      <form onSubmit={handleUpdateProfile} className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Profile Information</h2>
        <div className="space-y-4">
          {/* Email (Read-only) */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-500">Email</label>
            <input
                id="email"
                type="email"
                // Use optional chaining just in case, though validation should ensure user.email exists
                value={user?.email || 'N/A'}
                readOnly
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm cursor-not-allowed"
            />
          </div>

          {/* Timezone Selection */}
          <div>
            <label htmlFor="timezone" className="block text-sm font-medium text-gray-700">Timezone</label>
            <select
              id="timezone"
              name="timezone"
              value={timezone} // Controlled component
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setTimezone(e.target.value)}
              disabled={isProcessing} // Disable while processing actions
              className={`mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md ${isProcessing ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            >
              {/* Default disabled option */}
              <option value="" disabled>Select your timezone</option>
              {/* Map over timezone list */}
              {timezones.map(tz => (
                <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">Affects when daily routines reset and notification timings.</p>
          </div>

          {/* Phone Number Input */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone Number (Optional)</label>
            <input
                id="phone"
                type="tel" // Use 'tel' type for semantic meaning and potential mobile features
                value={phoneNumber} // Controlled component
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPhoneNumber(e.target.value)}
                placeholder="e.g., +1 555 123 4567 (Include country code)"
                disabled={isProcessing} // Disable while processing actions
                className={`mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${isProcessing ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            />
            <p className="mt-1 text-xs text-gray-500">Used for SMS notifications (if enabled below).</p>
          </div>

          {/* SMS Notifications Checkbox */}
          <div className="relative flex items-start pt-2">
            <div className="flex items-center h-5">
              <input
                id="sms-notifications"
                aria-describedby="sms-notifications-description"
                name="sms-notifications"
                type="checkbox"
                checked={smsEnabled} // Controlled component
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSmsEnabled(e.target.checked)}
                disabled={isProcessing} // Disable while processing actions
                className={`focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded ${isProcessing ? 'cursor-not-allowed opacity-50' : ''}`}
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="sms-notifications" className={`font-medium ${isProcessing ? 'text-gray-500' : 'text-gray-700'}`}>
                Enable SMS Notifications
              </label>
              <p id="sms-notifications-description" className="text-xs text-gray-500">
                Receive reminders via SMS. Message rates may apply. Requires a valid phone number.
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <button
                type="submit"
                // Disable if processing OR if profile hasn't loaded (or doesn't exist)
                // Allow saving even if profile is null, to potentially create/update timezone/sms settings
                disabled={isProcessing || !profile}
                className={`inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {/* Show loading indicator inside button when processing */}
              {isProcessing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Saving...
                </>
              ) : (
                "Save Profile Changes"
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Account Actions Section */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Account Actions</h2>
        <div className="space-y-4">
          {/* Password Reset */}
          <div>
            <h3 className="text-md font-medium text-gray-900">Change Password</h3>
            <p className="mt-1 text-sm text-gray-500">Send a password reset link to your email address ({user?.email}).</p>
            <button
                onClick={handlePasswordReset}
                disabled={isProcessing} // Disable while processing actions
                className={`mt-3 inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isProcessing ? 'Sending...' : 'Send Reset Email'}
            </button>
          </div>
          <hr/>
          {/* Account Deletion */}
          <div>
            <h3 className="text-md font-medium text-red-700">Delete Account</h3>
            <p className="mt-1 text-sm text-gray-500">Permanently delete your account and all associated data (habits, logs, profile). This action cannot be undone.</p>
            <button
                onClick={handleDeleteAccount}
                disabled={isProcessing} // Disable while processing actions
                className={`mt-3 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isProcessing ? 'Processing...' : 'Delete My Account'}
            </button>
            <p className="mt-2 text-xs text-red-600 italic">Note: Account deletion should be handled securely on the backend. This button currently uses placeholder logic.</p>
          </div>
        </div>
      </div>
    </div>
  );
}