'use client';

import { useEffect, useState, useCallback, ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

// Define the Profile type based on your schema and src/types/index.ts
type Profile = {
    id: string; // UUID, matches auth.users.id
    updated_at: string | null;
    display_name: string | null;
    phone: string | null;
    avatar_url: string | null;
    enable_sms_notifications: boolean; // Added for consent
};

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [smsEnabled, setSmsEnabled] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- Fetch user and profile data ---
  const fetchData = useCallback(async () => {
    console.log("SettingsPage: Starting fetchData...");
    setLoading(true);
    setError(null);
    setMessage(null);
    setProfile(null);
    setPhoneNumber('');
    setSmsEnabled(false);

    try {
      // 1. Fetch Auth User
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!currentUser) {
        console.log("SettingsPage: No user found, redirecting to signin.");
        router.push('/auth/signin');
        return;
      }
      console.log("SettingsPage: User fetched:", currentUser.id);
      setUser(currentUser);


      // 2. Fetch Profile using the user ID
      console.log("SettingsPage: Fetching profile for user:", currentUser.id);
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single(); // Using single() assuming profile must exist or it's an error state

      if (profileError) {
          if (profileError.code === 'PGRST116') {
               console.warn("SettingsPage: Profile row not found for this user.", profileError);
               setError("Profile data not found. Please contact support or ensure your profile exists.");
          } else {
               throw profileError; // Throw other errors
          }
      } else if (profileData) {
          console.log("SettingsPage: Profile fetched:", profileData);
          setProfile(profileData);
          setPhoneNumber(profileData.phone || '');
          setSmsEnabled(profileData.enable_sms_notifications || false);
      }

    // --- FIXED: Changed 'any' to 'unknown' and added type check ---
    } catch (err: unknown) {
      console.error('SettingsPage: Error fetching data:', err);
      let errorMessage = "Failed to load user or profile data. Please try refreshing.";
      if (err instanceof Error) {
          // Use specific messages based on known error patterns if possible
          if (err.message.includes("relation \"public.profiles\" does not exist")) {
              errorMessage = "Database error: Profiles table not found.";
          } else if (err.message.includes("permission denied")) {
              errorMessage = "Permission denied. Please check database permissions (RLS policies and Grants).";
          } else {
              errorMessage = err.message; // Use the actual error message
          }
      }
      setError(errorMessage);
      setUser(null);
      setProfile(null);
      setPhoneNumber('');
      setSmsEnabled(false);
    } finally {
      setLoading(false);
      console.log("SettingsPage: fetchData finished.");
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Action Handlers ---
  const handlePasswordReset = async () => {
    if (!user?.email) { setError("Could not find user's email address."); return; }
    setIsProcessing(true); setError(null); setMessage(null);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(user.email, {});
      if (resetError) throw resetError;
      setMessage('Password reset email sent. Please check your inbox.');
    // --- FIXED: Changed 'any' to 'unknown' and added type check ---
    } catch (err: unknown) {
      console.error("Password Reset Error:", err);
      // Set error message, checking if err is an Error instance
      setError(err instanceof Error ? err.message : 'Failed to send password reset email.');
    } finally {
      setIsProcessing(false);
    }
  };

  // --- UPDATED: Profile Update Handler ---
  const handleUpdateProfile = async (e: FormEvent) => {
      e.preventDefault();
      if (!user || !profile) {
          setError("User or profile data not loaded, cannot update.");
          return;
      }

      setIsProcessing(true); setError(null); setMessage(null);
      console.log("SettingsPage: Attempting to update profile for user:", user.id, "with phone:", phoneNumber, "SMS enabled:", smsEnabled);

      const updates = {
          id: user.id,
          phone: phoneNumber.trim() === '' ? null : phoneNumber.trim(),
          enable_sms_notifications: smsEnabled,
          updated_at: new Date().toISOString(),
      };

      try {
          const { error: updateError } = await supabase
              .from('profiles')
              .update(updates)
              .eq('id', user.id);

          if (updateError) {
              if (updateError.message.includes("violates row-level security policy")) {
                  console.error("RLS Error during profile update:", updateError);
                  setError("Update failed: Permission denied. Please check RLS policies for updates.");
              } else {
                  throw updateError; // Throw other update errors
              }
          } else {
              console.log("SettingsPage: Profile updated successfully.");
              setMessage('Profile updated successfully!');
              setProfile(prevProfile => prevProfile ? { ...prevProfile, ...updates } : null);
          }
      // --- FIXED: Changed 'any' to 'unknown' and added type check ---
      } catch (err: unknown) {
          console.error("Profile Update Error:", err);
          // Set error message, checking if err is an Error instance
          setError(err instanceof Error ? err.message : 'Failed to update profile.');
      } finally {
          setIsProcessing(false);
      }
  };
  // --- End UPDATED Handler ---

  const handleDeleteAccount = async () => {
     if (!user) return;
    if (!window.confirm('Are you absolutely sure you want to delete your account? This action cannot be undone and all your data (logs, habits) will be lost.')) {
      return;
    }
    setIsProcessing(true); setError(null); setMessage(null);
    console.warn("Account deletion initiated - Placeholder logic. Requires secure backend implementation.");
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsProcessing(false);
    setError("Account deletion requires backend setup (see console warning).");
  };

  // --- Render Logic ---
  console.log("SettingsPage: Rendering - Loading:", loading, "User:", !!user, "Profile:", !!profile, "Error:", error);

  // --- Loading State ---
  if (loading) {
    console.log("SettingsPage: Rendering Loading Spinner");
    return (
       <div className="min-h-screen flex items-center justify-center">
         <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
       </div>
    );
  }

  // --- Error State (if critical data missing) ---
  if (error && (!user || !profile)) {
     console.log("SettingsPage: Rendering error because error exists and user or profile is missing");
      return (
         <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
             <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-4" role="alert"><strong className="font-bold">Error: </strong><span className="block sm:inline">{error}</span><p className="text-sm mt-1">Please try refreshing the page. If the problem persists, contact support or check your Supabase RLS/Grant configuration.</p></div>
              <div className="mt-4"><Link href="/dashboard" className="text-sm text-indigo-600 hover:underline">&larr; Back to Dashboard</Link></div>
         </div>
     );
  }

  // --- Null State (if data still loading somehow after loading flag false) ---
  if (!user || !profile) {
     console.log("SettingsPage: Rendering null because !user or !profile (after loading)");
     return <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8"><p>Loading user data...</p></div>;
  }

  // --- Main Content Render ---
  console.log("SettingsPage: Rendering main content area...");
  return (
     <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 font-sans"> {/* NOTE: font-sans applied here - maybe remove if body applies default? */}
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Settings</h1>
        <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline">&larr; Back to Dashboard</Link>
      </div>

      {/* Feedback Messages */}
      {message && ( <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg relative mb-4" role="alert"><p>{message}</p></div> )}
      {/* Show non-critical errors only if no success message */}
      {error && !message && ( <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-4" role="alert"><strong className="font-bold">Error: </strong><span className="block sm:inline">{error}</span></div> )}

      {/* Profile Info Form */}
      <form onSubmit={handleUpdateProfile} className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Profile Information</h2>
        <div className="space-y-4">
          {/* Email (Read-only) */}
          <div>
             <label htmlFor="email" className="block text-sm font-medium text-gray-500">Email</label>
            <input id="email" type="email" value={user.email || 'N/A'} readOnly className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm cursor-not-allowed"/>
          </div>

          {/* Phone Number (Editable) */}
          <div>
             <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone Number</label>
            <input id="phone" type="tel" value={phoneNumber} onChange={(e: ChangeEvent<HTMLInputElement>) => setPhoneNumber(e.target.value)} placeholder="e.g., +1 555 123 4567 (Include country code)" disabled={isProcessing} className={`mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${isProcessing ? 'bg-gray-100' : ''}`}/>
             <p className="mt-1 text-xs text-gray-500">Used for SMS notifications (if enabled below).</p>
          </div>

          {/* SMS Consent Checkbox */}
          <div className="relative flex items-start pt-2">
            <div className="flex items-center h-5">
              <input id="sms-notifications" aria-describedby="sms-notifications-description" name="sms-notifications" type="checkbox" checked={smsEnabled} onChange={(e: ChangeEvent<HTMLInputElement>) => setSmsEnabled(e.target.checked)} disabled={isProcessing} className={`focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded ${isProcessing ? 'cursor-not-allowed' : ''}`}/>
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="sms-notifications" className={`font-medium ${isProcessing ? 'text-gray-500' : 'text-gray-700'}`}>Enable SMS Notifications</label>
              <p id="sms-notifications-description" className="text-xs text-gray-500">Receive reminders for Startup/Shutdown routines and weekly reports via SMS. Message rates may apply.</p>
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-4">
             <button type="submit" disabled={isProcessing || !profile} className={`inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${(isProcessing || !profile) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {isProcessing ? (<><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Saving...</>) : ('Save Profile Changes')}
            </button>
          </div>
        </div>
      </form>

      {/* Account Actions */}
       <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Account Actions</h2>
        <div className="space-y-4">
          {/* Change Password */}
          <div>
            <h3 className="text-md font-medium text-gray-900">Change Password</h3>
            <p className="mt-1 text-sm text-gray-500">Send a password reset link to your email address.</p>
            <button onClick={handlePasswordReset} disabled={isProcessing} className={`mt-3 inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {isProcessing ? 'Sending...' : 'Send Reset Email'}
             </button>
          </div>
          <hr/>
          {/* Delete Account */}
          <div>
            <h3 className="text-md font-medium text-red-700">Delete Account</h3>
            <p className="mt-1 text-sm text-gray-500">Permanently delete your account and all associated data (habits, logs). This action cannot be undone.</p>
             <button onClick={handleDeleteAccount} disabled={isProcessing} className={`mt-3 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}>
               {isProcessing ? 'Processing...' : 'Delete My Account'}
             </button>
             <p className="mt-2 text-xs text-gray-500 italic">Note: Account deletion requires secure backend setup. This button currently shows a placeholder message.</p>
          </div>
        </div>
      </div>
    </div>
  );
}