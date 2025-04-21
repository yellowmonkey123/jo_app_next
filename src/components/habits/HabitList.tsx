'use client';
import React, { useEffect, useState, useMemo } from 'react';
// Assuming Habit and HabitTiming are correctly defined in '@/types'
import { Habit, HabitTiming } from '@/types';
// Assuming these functions are correctly defined and handle Supabase client internally or receive it
import { getHabitsForUser, deleteHabitById, updateHabitOrder } from '@/lib/supabase/habits';
// Import the function to get the Supabase client
import { getSupabaseClient } from '@/lib/supabase/supabaseClient';
// Import Dnd-Kit components for drag and drop
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
// Import an icon for the drag handle
import { Bars3Icon } from '@heroicons/react/24/solid';

// Define the props expected by the HabitList component
interface HabitListProps {
  onEdit: (habit: Habit) => void; // Callback when edit button is clicked
  refreshKey: number; // Key to trigger data refresh
}

// Define the order and labels/colors for timing groups
const timingGroups: HabitTiming[] = [HabitTiming.AM, HabitTiming.ANYTIME, HabitTiming.PM];

const getTimingLabel = (timing: HabitTiming): string => {
  switch (timing) {
    case HabitTiming.AM: return 'Morning';
    case HabitTiming.PM: return 'Evening';
    case HabitTiming.ANYTIME: return 'Anytime';
    // Ensure all cases are handled or throw error
    default:
        // This should ideally not happen if HabitTiming enum is exhaustive
        console.error('Unhandled timing value in getTimingLabel:', timing);
        return 'Unknown'; // Fallback label
  }
};

const getTimingColor = (timing: HabitTiming): string => {
  switch (timing) {
    case HabitTiming.AM: return 'bg-yellow-100 text-yellow-800';
    case HabitTiming.PM: return 'bg-blue-100 text-blue-800';
    case HabitTiming.ANYTIME: return 'bg-green-100 text-green-800';
     // Ensure all cases are handled or throw error
    default:
        console.error('Unhandled timing value in getTimingColor:', timing);
        return 'bg-gray-100 text-gray-800'; // Fallback color
  }
};

// Define props for the individual sortable habit item component
interface SortableHabitItemProps {
  habit: Habit;
  onEdit: (h: Habit) => void;
  onDelete: (id: string) => void;
}

// Component for rendering a single draggable habit item
function SortableHabitItem({ habit, onEdit, onDelete }: SortableHabitItemProps) {
  // useSortable hook from dnd-kit
  const {
    attributes, // Props to spread onto the draggable element
    listeners,  // Props to spread onto the drag handle element
    setNodeRef, // Ref function for the draggable element
    transform,  // CSS transform for movement
    transition, // CSS transition for smooth animation
    isDragging, // Boolean indicating if the item is currently being dragged
  } = useSortable({ id: habit.id }); // Unique ID for the sortable item

  // Apply CSS styles for dragging effects
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1, // Reduce opacity when dragging
    zIndex: isDragging ? 10 : 'auto', // Ensure dragging item is above others
    boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.15)' : 'none', // Add shadow when dragging
    backgroundColor: isDragging ? 'white' : 'transparent', // Optional: background change
  };

  return (
    // The list item element that becomes sortable
    <li ref={setNodeRef} style={style} className="py-4 flex items-center space-x-2 bg-white border-b border-gray-100" {...attributes}>
      {/* Drag Handle Button */}
      <button
        {...listeners} // Attach drag listeners here
        className="cursor-grab touch-none rounded text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 flex items-center justify-center p-1"
        aria-label={`Drag handle for ${habit.name}`} // Accessibility label
      >
        <Bars3Icon className="w-5 h-5" />
      </button>
      {/* Habit Details */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{habit.name}</p>
        {/* Timing Badge */}
        <p className="text-sm text-gray-500">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTimingColor(habit.timing)}`}>
            {getTimingLabel(habit.timing)}
          </span>
        </p>
      </div>
      {/* Action Buttons */}
      <div className="inline-flex items-center space-x-2">
        <button
          onClick={() => onEdit(habit)} // Trigger edit callback
          type="button"
          className="inline-flex items-center px-2.5 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(habit.id)} // Trigger delete callback
          type="button"
          className="inline-flex items-center px-2.5 py-1 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          Delete
        </button>
      </div>
    </li>
  );
}

// Main HabitList component
export default function HabitList({ onEdit, refreshKey }: HabitListProps) {
  // State for storing the list of habits
  const [habits, setHabits] = useState<Habit[]>([]);
  // State for loading indicator
  const [loading, setLoading] = useState(true);
  // State for error messages
  const [error, setError] = useState<string | null>(null);

  // Configure dnd-kit sensors (Pointer for mouse/touch, Keyboard for accessibility)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Effect hook to fetch habits when the component mounts or refreshKey changes
  useEffect(() => {
    console.log("HabitList: refreshKey changed or component mounted, fetching habits...");
    fetchHabits();
    // Dependency array: re-run effect if refreshKey changes
  }, [refreshKey]);

  // Async function to fetch habits from the database
  const fetchHabits = async () => {
    // Get Supabase client instance
    const supabase = getSupabaseClient();

    // --- Start Fix: Check if Supabase client initialized successfully ---
    if (!supabase) {
        console.error('HabitList: Supabase client is null. Check environment configuration.');
        // Set component's error state
        setError('Database connection failed. Please check setup or try again later.');
        setLoading(false); // Ensure loading stops
        setHabits([]); // Clear any potentially stale habit data
        return; // Stop execution of fetchHabits
    }
    // --- End Fix ---
    console.log("HabitList: Supabase client validated.");

    // Now it's safe to proceed with the try...catch block
    try {
      setLoading(true); // Indicate loading started
      setError(null); // Clear previous errors

      // 1. Get the current authenticated user
      // supabase is guaranteed non-null here
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      // Handle authentication errors
      if (userError) {
          console.error("HabitList: Authentication error:", userError);
          throw new Error(`Authentication error: ${userError.message}`);
      }
      // Handle case where no user is logged in
      if (!user) {
        console.warn("HabitList: No authenticated user found. Cannot fetch habits.");
        setHabits([]); // Clear habits list
        // Consider redirecting or showing a login prompt if appropriate for the context
        // router.push('/auth/signin'); // Example redirect
        // No need to setLoading(false) here, finally block handles it
        return; // Stop if no user
      }
      console.log("HabitList: User found:", user.id, ". Fetching habits...");

      // 2. Fetch habits for the authenticated user
      // Assuming getHabitsForUser handles its own Supabase client or receives one
      const fetchedHabits = await getHabitsForUser(user.id);
      console.log("HabitList: Habits fetched successfully:", fetchedHabits.length);
      setHabits(fetchedHabits); // Update state with fetched habits

    } catch (err: unknown) {
      // Catch errors from auth check or getHabitsForUser
      console.error('HabitList Component Error: Fetching habits failed:', err);
      // Set user-friendly error message
      setError(err instanceof Error ? err.message : 'An unexpected error occurred while loading habits.');
      setHabits([]); // Clear habits list on error
    } finally {
      // Ensure loading state is turned off regardless of success or failure
      setLoading(false);
      console.log("HabitList: Fetch habits process finished.");
    }
  };

  // Async function to delete a habit
  const deleteHabit = async (id: string) => {
    // Confirmation dialog
    if (!window.confirm('Are you sure you want to delete this habit? This action cannot be undone.')) {
      return; // User cancelled
    }
    console.log("HabitList: Attempting to delete habit ID:", id);
    try {
      setError(null); // Clear previous errors
      // Call the service function to delete the habit
      await deleteHabitById(id);
      console.log("HabitList: Habit deleted successfully via service.");
      // Optimistically update the UI by removing the habit from the local state
      setHabits(prevHabits => prevHabits.filter(habit => habit.id !== id));
    } catch (err: unknown) {
      // Catch errors during deletion
      console.error('HabitList Component Error: Deleting habit failed:', err);
       // Set user-friendly error message
      setError(err instanceof Error ? err.message : 'Failed to delete the habit.');
      // Optionally: Re-fetch habits to ensure consistency after error
      // fetchHabits();
    }
  };

  // Memoized computation to group habits by timing
  const groupedHabits = useMemo(() => {
    // Ensure habits is an array before processing
    if (!Array.isArray(habits)) {
        console.warn("HabitList: Habits state is not an array during grouping.");
        return {}; // Return empty object if habits is not an array
    }
    // Create an object to hold habits grouped by timing
    const groups: { [key in HabitTiming]?: Habit[] } = {};
    // Iterate over predefined timing groups to ensure consistent order
    for (const timing of timingGroups) {
      // Filter habits belonging to the current timing group
      groups[timing] = habits.filter(h => h.timing === timing);
      // Note: Sorting within the group is handled by the fetched order initially
    }
    return groups;
  }, [habits]); // Recompute only when the habits array changes

  // Async function to save the new order after drag-and-drop
  const saveNewOrder = async (reorderedGroup: Habit[]) => {
    setError(null); // Clear previous errors
    // Extract ordered IDs from the reordered habit objects
    const orderedIds = reorderedGroup.map(habit => habit.id);
    // Don't proceed if the group is empty
    if (orderedIds.length === 0) {
      console.log("HabitList: No habits in the reordered group to save.");
      return;
    }
    console.log("HabitList: Attempting to save new order via service:", orderedIds);
    try {
      // Call the service function to update the order in the database
      await updateHabitOrder(orderedIds);
      console.log("HabitList: Successfully saved new order via service.");
      // Optionally: show a success message to the user
    } catch (err: unknown) {
      // Catch errors during order update
      console.error('HabitList Component Error: Saving habit order failed:', err);
       // Set user-friendly error message
      setError(err instanceof Error ? err.message : 'Failed to save the new habit order.');
      // Consider reverting the local state change or re-fetching on error
      // fetchHabits(); // Example: Re-fetch to get actual DB order
    }
  };

  // Handler for the 'dragEnd' event from dnd-kit
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event; // Get the active (dragged) and over (dropped on) items

    // Check if the drop target is valid and different from the start
    if (!over || active.id === over.id) {
        console.log("HabitList: Drag ended without valid target or no movement.");
        return;
    }
    // Ensure habits state is an array
    if (!Array.isArray(habits)) {
        console.error("HabitList: Habits state is not an array on drag end.");
        return;
    }

    // Find the habit objects corresponding to the active and over IDs
    const activeHabit = habits.find(h => h.id === active.id);
    const overHabit = habits.find(h => h.id === over.id);

    // Check if habits were found and if they belong to the same timing group
    // Dragging between different timing groups is not allowed in this setup
    if (!activeHabit || !overHabit || activeHabit.timing !== overHabit.timing) {
      console.log("HabitList: Drag ended over invalid target (different timing group or habit not found).");
      return;
    }

    // Identify the timing group being reordered
    const currentTimingGroup = activeHabit.timing;
    console.log(`HabitList: Drag ended within timing group: ${currentTimingGroup}. Active: ${active.id}, Over: ${over.id}`);

    // Update the local state optimistically
    setHabits((prevHabits) => {
      if (!Array.isArray(prevHabits)) return []; // Safeguard

      // Get items belonging only to the current timing group
      const currentGroupItems = prevHabits.filter(h => h.timing === currentTimingGroup);

      // Find the old and new indices within this specific group
      const oldIndex = currentGroupItems.findIndex((h) => h.id === active.id);
      const newIndex = currentGroupItems.findIndex((h) => h.id === over.id);

      // Check if indices are valid
      if (oldIndex === -1 || newIndex === -1) {
          console.error("HabitList: Could not find old or new index within the group.");
          return prevHabits; // Return previous state if indices are invalid
      }

      // Reorder the items within the specific timing group
      const reorderedGroup = arrayMove(currentGroupItems, oldIndex, newIndex);
      console.log("HabitList: Reordered group:", reorderedGroup.map(h => h.id));

      // Trigger the async function to save the new order to the database
      // This happens after the state update is initiated
      saveNewOrder(reorderedGroup);

      // Reconstruct the full habits array with the reordered group
      const newHabitsArray: Habit[] = [];
      timingGroups.forEach(timing => {
        if (timing === currentTimingGroup) {
          // Add the newly reordered items for the current group
          newHabitsArray.push(...reorderedGroup);
        } else {
          // Add items from other groups as they were
          newHabitsArray.push(...prevHabits.filter(h => h.timing === timing));
        }
      });
      // Return the newly constructed array for the state update
      return newHabitsArray;
    });
  }

  // --- Render Logic ---

  // Display loading state
  if (loading) {
    return <div className="py-4 text-center text-gray-500 italic">Loading habits...</div>;
  }

  // Display message if no habits are loaded and there's no error
  if (!loading && habits.length === 0 && !error) {
    return (
      <div className="text-center py-10 px-6 bg-gray-50 rounded-lg mt-6">
        {/* Placeholder icon */}
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="mt-2 text-sm font-semibold text-gray-900">No habits yet</h3>
        <p className="mt-1 text-sm text-gray-500">Get started by adding your first habit using the form above.</p>
      </div>
    );
  }

  // Main render when habits are loaded (or if there's an error to display alongside)
  return (
    <div className="mt-6">
      <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Your Habits</h3>
      {/* Display error banner if an error occurred */}
      {error && (
        // Assuming ErrorBanner component exists and takes 'message' prop
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 my-4 rounded-md shadow text-sm" role="alert">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
        </div>
        // <ErrorBanner message={error} /> // Use this if you have the component
      )}

      {/* DndContext wrapper for enabling drag and drop */}
      <DndContext
        sensors={sensors} // Attach configured sensors
        collisionDetection={closestCenter} // Use basic collision detection
        onDragEnd={handleDragEnd} // Callback function when dragging ends
      >
        {/* Iterate over timing groups to render habits section by section */}
        {timingGroups.map((timing) => {
          // Get habits belonging to the current timing group
          const currentGroupHabits = groupedHabits?.[timing] || [];
          // Get IDs for SortableContext
          const habitIds = currentGroupHabits.map(h => h.id);
          // Don't render the section if there are no habits for this timing
          if (currentGroupHabits.length === 0) return null;

          return (
            // Section for each timing group
            <div key={timing} className="mb-8">
              {/* Timing group header */}
              <div className="pb-2 mb-2 border-b-2 border-gray-200">
                <h4 className="text-md font-semibold text-gray-700">{getTimingLabel(timing)} Habits</h4>
              </div>
              {/* SortableContext provides context for sortable items */}
              <SortableContext items={habitIds} strategy={verticalListSortingStrategy}>
                {/* Unordered list to hold the sortable habit items */}
                <ul role="list" className="bg-white rounded-md shadow-sm">
                  {/* Map over habits in the current group */}
                  {currentGroupHabits.map((habit) => (
                    // Render each habit using the SortableHabitItem component
                    <SortableHabitItem
                      key={habit.id} // Unique key for React
                      habit={habit} // Pass habit data
                      onEdit={onEdit} // Pass edit callback
                      onDelete={deleteHabit} // Pass delete callback
                    />
                  ))}
                </ul>
              </SortableContext>
            </div>
          );
        })}
      </DndContext>
    </div>
  );
}