'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null); // For feedback messages
  const [isProcessing, setIsProcessing] = useState(false); // For button loading states

  // Fetch user data on mount
  useEffect(() => {
    const fetchUser = async () => {
      setLoading(true);
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();

      if (userError || !currentUser) {
        console.error('Error fetching user or user not found:', userError);
        router.push('/auth/signin'); // Redirect if not logged in or error
        return;
      }
      setUser(currentUser);
      setLoading(false);
    };
    fetchUser();
  }, [router]);

  // --- Action Handlers ---

  const handlePasswordReset = async () => {
    if (!user?.email) {
      setError("Could not find user's email address.");
      return;
    }
    setIsProcessing(true);
    setError(null);
    setMessage(null);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(user.email, {
        // Optional: Specify where the link in the email should redirect the user *after* password reset
        // redirectTo: `${window.location.origin}/auth/update-password`, // Example redirect URL
      });
      if (resetError) throw resetError;
      setMessage('Password reset email sent. Please check your inbox.');
    } catch (err: any) {
      console.error("Password Reset Error:", err);
      setError(err.message || 'Failed to send password reset email.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;

    // --- CRITICAL: Confirmation ---
    if (!window.confirm('Are you absolutely sure you want to delete your account? This action cannot be undone and all your data (logs, habits) will be lost.')) {
      return;
    }

    setIsProcessing(true);
    setError(null);
    setMessage(null);

    // --- IMPORTANT SECURITY NOTE ---
    // Deleting a user directly from the client-side using their session is often disabled
    // for security reasons in Supabase row-level security policies (RLS).
    // Proper account deletion typically requires elevated privileges (service_role key)
    // and should be handled via a secure Supabase Edge Function or a custom backend endpoint.
    // The following is a placeholder and likely WILL NOT WORK without backend changes.
    console.warn("Account deletion initiated - Placeholder logic. Requires secure backend implementation.");
    setMessage("Account deletion request received (placeholder - requires backend function).");
    // Example of what a *backend* function might do (DO NOT RUN THIS ON CLIENT):
    // const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    // if (deleteError) throw deleteError;
    // await supabase.auth.signOut(); // Sign out after deletion
    // router.push('/'); // Redirect to home

    // Simulate processing for placeholder
    await new Promise(resolve => setTimeout(resolve, 1000));
    // In a real scenario, you would sign out and redirect after successful backend deletion.
    // For now, just reset the processing state.
    setIsProcessing(false);
     setError("Account deletion requires backend setup (see console warning)."); // Inform user
  };


  // --- Render Logic ---

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  if (!user) {
    // Should have been redirected, but render null as fallback
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Settings</h1>
        <Link
          href="/dashboard"
          className="text-sm text-indigo-600 hover:underline"
        >
          &larr; Back to Dashboard
        </Link>
      </div>

      {/* Feedback Messages */}
      {message && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
          <span className="block sm:inline">{message}</span>
        </div>
      )}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {/* Profile Information Section */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Profile Information</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-500">Email</label>
            <p className="mt-1 text-sm text-gray-900">{user.email}</p>
          </div>
          {/* Add other profile fields here if needed (e.g., Display Name) */}
        </div>
      </div>

      {/* Account Actions Section */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Account Actions</h2>
        <div className="space-y-4">
          {/* Change Password */}
          <div>
            <h3 className="text-md font-medium text-gray-900">Change Password</h3>
            <p className="mt-1 text-sm text-gray-500">
              Send a password reset link to your email address.
            </p>
            <button
              onClick={handlePasswordReset}
              disabled={isProcessing}
              className={`mt-3 inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isProcessing ? 'Sending...' : 'Send Reset Email'}
            </button>
          </div>

          <hr/>

          {/* Delete Account */}
          <div>
            <h3 className="text-md font-medium text-red-700">Delete Account</h3>
            <p className="mt-1 text-sm text-gray-500">
              Permanently delete your account and all associated data (habits, logs). This action cannot be undone.
            </p>
            <button
              onClick={handleDeleteAccount}
              disabled={isProcessing}
              className={`mt-3 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isProcessing ? 'Processing...' : 'Delete My Account'}
            </button>
             <p className="mt-2 text-xs text-gray-500 italic">
                Note: Account deletion requires secure backend setup. This button currently shows a placeholder message.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}
