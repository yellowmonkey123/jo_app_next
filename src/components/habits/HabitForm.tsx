'use client';
import { useState, useEffect, FormEvent } from 'react';
// Assuming HabitTiming is correctly defined in '@/types'
import { HabitTiming } from '@/types';
// Import the function to get the Supabase client
import { getSupabaseClient } from '@/lib/supabase/supabaseClient';

// Define the props expected by the HabitForm component
interface HabitFormProps {
  // Callback function to execute on successful save/update
  onSuccess: () => void;
  // Optional initial data for editing an existing habit
  initialData?: {
    id: string; // ID of the habit being edited
    name: string; // Current name
    timing: HabitTiming; // Current timing
  };
}

export default function HabitForm({ onSuccess, initialData }: HabitFormProps) {
  // State for form fields
  const [name, setName] = useState('');
  const [timing, setTiming] = useState<HabitTiming>(HabitTiming.ANYTIME);
  // State for UI feedback
  const [loading, setLoading] = useState(false); // Tracks async operation progress
  const [error, setError] = useState<string | null>(null); // Stores error messages

  // Determine if the form is in 'edit' mode based on initialData presence
  const isEditing = !!initialData;

  // Effect to populate form fields when initialData changes (for editing)
  useEffect(() => {
    if (initialData) {
      // If editing, set state from initialData
      setName(initialData.name);
      setTiming(initialData.timing);
      console.log("HabitForm: Populated form for editing habit ID:", initialData.id);
    } else {
      // If adding a new habit, reset form fields
      setName('');
      setTiming(HabitTiming.ANYTIME);
      console.log("HabitForm: Reset form for adding new habit.");
    }
    // Dependency array: re-run effect if initialData object reference changes
  }, [initialData]);

  // Handler for form submission (add or update habit)
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); // Prevent default browser form submission
    setLoading(true); // Indicate loading state
    setError(null); // Clear previous errors

    // Get Supabase client instance
    const supabase = getSupabaseClient();

    // --- Start Fix: Check if Supabase client initialized successfully ---
    if (!supabase) {
        console.error('HabitForm: Supabase client is null. Check environment configuration.');
        // Set user-facing error message
        setError('Database connection failed. Please check your setup or try again later.');
        setLoading(false); // Reset loading state
        return; // Stop the submission process
    }
    // --- End Fix ---

    console.log("HabitForm: Supabase client validated.");

    // Basic validation for habit name
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Habit name cannot be empty.');
      setLoading(false);
      return;
    }

    try {
      // Ensure user is authenticated before proceeding
      // Now it's safe to use supabase here
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
          console.error("HabitForm: Error fetching user:", userError);
          throw userError; // Rethrow to be caught below
      }
      if (!user) {
          console.error("HabitForm: User not logged in.");
          throw new Error('You must be logged in to manage habits');
      }
      console.log("HabitForm: User authenticated:", user.id);

      // Logic for UPDATING an existing habit
      if (isEditing && initialData) {
        console.log(`HabitForm: Updating habit ID: ${initialData.id} with name: ${trimmedName}, timing: ${timing}`);
        const { error: updateError } = await supabase
          .from('habits') // Target 'habits' table
          .update({ name: trimmedName, timing: timing }) // Fields to update
          .eq('id', initialData.id) // Match the habit ID
          .eq('user_id', user.id); // Ensure user owns the habit

        if (updateError) {
            console.error("HabitForm: Error updating habit:", updateError);
            throw updateError; // Rethrow to be caught below
        }
        console.log("HabitForm: Habit updated successfully.");

      // Logic for ADDING a new habit
      } else {
        console.log(`HabitForm: Adding new habit with name: ${trimmedName}, timing: ${timing}`);
        // Fetch the maximum sort_order for the same user and timing to append the new habit
        const { data: maxOrderData, error: maxOrderError } = await supabase
          .from('habits')
          .select('sort_order')
          .eq('user_id', user.id)
          .eq('timing', timing) // Filter by the selected timing
          .order('sort_order', { ascending: false, nullsFirst: false }) // Get the highest number
          .limit(1)
          .maybeSingle(); // Returns one row or null

        // Handle potential error during sort order fetch, but don't block insertion
        if (maxOrderError) {
          console.error("HabitForm: Error fetching max sort order (continuing with default):", maxOrderError);
          // Optionally set a specific error state or just log it
        }

        // Determine the new sort order
        // If no existing habits for this timing, start at 0. Otherwise, increment the max.
        const maxSortOrder = maxOrderData?.sort_order ?? -1; // Default to -1 if null or no data
        const newSortOrder = maxSortOrder + 1;
        console.log("HabitForm: Determined new sort_order:", newSortOrder);

        // Insert the new habit record
        const { error: insertError } = await supabase
          .from('habits')
          .insert({
            name: trimmedName,
            timing: timing,
            user_id: user.id, // Associate with the logged-in user
            sort_order: newSortOrder, // Set the calculated sort order
          });

        if (insertError) {
            console.error("HabitForm: Error inserting habit:", insertError);
            throw insertError; // Rethrow to be caught below
        }
         console.log("HabitForm: Habit added successfully.");
      }

      // If save/update was successful, call the onSuccess callback provided by the parent
      onSuccess();

    } catch (err: unknown) {
      // Catch errors from auth, update, select, or insert operations
      console.error("HabitForm: Error during handleSubmit execution:", err);
      // Set user-friendly error messages
      if (err instanceof Error) {
          // Check for specific database constraint errors (like unique name/timing)
          if (err.message?.includes('duplicate key value violates unique constraint')) {
            setError('A habit with this name and timing might already exist.');
          } else if (err.message?.includes('violates row-level security policy')) {
            setError('Permission denied. You might not be allowed to perform this action.');
          }
          else {
            // Generic error message from the Error object
            setError(err.message || 'An error occurred while saving the habit.');
          }
      } else {
        // Fallback for non-Error exceptions
        setError('An unexpected error occurred while saving the habit.');
      }
    } finally {
      // Ensure loading state is reset regardless of success or failure
      setLoading(false);
    }
  };

  // --- Render Logic ---
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Display Error Banner if an error exists */}
      {error && (
        // Assuming ErrorBanner component exists and accepts 'message'
        // If ErrorBanner needs onDismiss, that needs to be handled separately
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md text-sm" role="alert">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
        </div>
        // <ErrorBanner message={error} /> // Use this if you have the component
      )}

      {/* Habit Name Input */}
      <div>
        <label htmlFor="habit-name" className="block text-sm font-medium text-gray-700 mb-1">
          Habit Name
        </label>
        <input
          type="text"
          id="habit-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2"
          placeholder="e.g., Morning meditation"
          required // HTML5 required attribute
          disabled={loading} // Disable input while loading
        />
      </div>

      {/* Habit Timing Selection */}
      <div>
        <label htmlFor="habit-timing" className="block text-sm font-medium text-gray-700 mb-1">
          Timing
        </label>
        <select
          id="habit-timing"
          value={timing}
          onChange={(e) => setTiming(e.target.value as HabitTiming)} // Cast value to HabitTiming enum
          className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 bg-white"
          disabled={loading} // Disable select while loading
        >
          {/* Map over HabitTiming enum values to create options */}
          {Object.values(HabitTiming).map(timingValue => (
            <option key={timingValue} value={timingValue}>
              {/* Provide user-friendly labels for enum values */}
              {timingValue === HabitTiming.AM ? 'Morning (AM)' : timingValue === HabitTiming.PM ? 'Evening (PM)' : 'Anytime'}
            </option>
          ))}
        </select>
      </div>

      {/* Submit Button */}
      <div>
        <button
          type="submit"
          disabled={loading || !name.trim()} // Disable if loading or name is empty/whitespace
          className={`inline-flex justify-center items-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {/* Show loading indicator inside button if loading */}
          {loading && (
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
          )}
          {/* Change button text based on loading state and edit mode */}
          {loading ? 'Saving...' : isEditing ? 'Update Habit' : 'Add Habit'}
        </button>
      </div>
    </form>
  );
}