'use client';

import React, { useEffect, useState, useMemo } from 'react';
// Import the Habit type and the HabitTiming enum
import { Habit, HabitTiming } from '@/types';
// *** Import the NEW service functions ***
import { getHabitsForUser, deleteHabitById, updateHabitOrder } from '@/lib/supabase/habits';
// We still need the client for auth check, OR move auth check elsewhere (e.g., layout)
import { supabase } from '@/lib/supabase/client';


// dnd-kit Imports
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

// Heroicons Import
import { Bars3Icon } from '@heroicons/react/24/solid';

// Component Props Interface
interface HabitListProps {
  onEdit: (habit: Habit) => void;
  refreshKey: number;
}

// Constants and Helpers
const timingGroups: HabitTiming[] = [HabitTiming.AM, HabitTiming.ANYTIME, HabitTiming.PM];

// *** RESTORED Implementation ***
const getTimingLabel = (timing: HabitTiming): string => {
   switch (timing) {
     case HabitTiming.AM: return 'Morning';
     case HabitTiming.PM: return 'Evening';
     case HabitTiming.ANYTIME: return 'Anytime';
     default:
       // This is for compile-time exhaustiveness checking
       // eslint-disable-next-line @typescript-eslint/no-unused-vars
       const exhaustiveCheck: never = timing;
       // Fallback runtime behavior
       return String(timing);
   }
 };

// *** RESTORED Implementation ***
const getTimingColor = (timing: HabitTiming): string => {
   switch (timing) {
    case HabitTiming.AM: return 'bg-yellow-100 text-yellow-800';
    case HabitTiming.PM: return 'bg-blue-100 text-blue-800';
    case HabitTiming.ANYTIME: return 'bg-green-100 text-green-800';
     default:
      // This is for compile-time exhaustiveness checking
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const exhaustiveCheck: never = timing;
      // Fallback runtime behavior
      return 'bg-gray-100 text-gray-800';
   }
 };

// *** RESTORED Implementation ***
// SortableHabitItem Sub-Component
interface SortableHabitItemProps {
    habit: Habit; // Expects a full Habit object
    onEdit: (h: Habit) => void;
    onDelete: (id: string) => void; // Assuming ID is string/uuid
}

// *** RESTORED Implementation ***
function SortableHabitItem({ habit, onEdit, onDelete }: SortableHabitItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: habit.id }); // Use habit.id

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 10 : 'auto',
    boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
    backgroundColor: isDragging? 'white' : 'transparent',
  };

  return (
    <li ref={setNodeRef} style={style} className="py-4 flex items-center space-x-2 bg-white" {...attributes}>
      {/* Drag Handle Button */}
      <button
        {...listeners}
        className="cursor-grab touch-none rounded text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 flex items-center justify-center p-1"
        aria-label={`Drag handle for ${habit.name}`}
      >
        <Bars3Icon className="w-5 h-5" />
      </button>
      {/* Habit Details */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{habit.name}</p>
        <p className="text-sm text-gray-500">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTimingColor(habit.timing)}`}>
            {getTimingLabel(habit.timing)}
          </span>
        </p>
      </div>
      {/* Action Buttons */}
      <div className="inline-flex items-center space-x-2">
        <button
          onClick={() => onEdit(habit)}
          type="button"
          className="inline-flex items-center px-2.5 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(habit.id)}
          type="button"
          className="inline-flex items-center px-2.5 py-1 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          Delete
        </button>
      </div>
    </li>
  );
}


// --- Main HabitList Component (Updated Logic) ---
export default function HabitList({ onEdit, refreshKey }: HabitListProps) {
  // State
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // dnd-kit Sensors setup
  const sensors = useSensors(
      useSensor(PointerSensor),
      useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Effect to fetch habits
  useEffect(() => {
    fetchHabits();
  }, [refreshKey]); // Dependency array ensures fetch runs when refreshKey changes

  // --- Data Fetching Function (Uses Service) ---
  const fetchHabits = async () => {
    try {
      setLoading(true);
      setError(null);
      // Still need to get the user ID here
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw new Error(`Authentication error: ${userError.message}`);
      if (!user) {
        console.warn("HabitList: No authenticated user found.");
        setHabits([]);
        setLoading(false); // Ensure loading stops if no user
        return; // Exit early
      }

      // *** Call the service function ***
      const fetchedHabits = await getHabitsForUser(user.id);
      setHabits(fetchedHabits);

    } catch (err: unknown) {
      // Catch errors thrown by the service function or getUser
      console.error('Component Error: Fetching habits failed:', err);
      // Set error state for the UI
      setError(err instanceof Error ? err.message : 'An unexpected error occurred while loading habits.');
      setHabits([]); // Clear habits on error
    } finally {
      setLoading(false);
    }
  };

  // --- Delete Habit Function (Uses Service) ---
  const deleteHabit = async (id: string) => {
     if (!confirm('Are you sure you want to delete this habit? This action cannot be undone.')) {
        return;
     }
     // Consider adding a loading state specific to deletion?
     try {
       setError(null); // Clear previous errors

       // *** Call the service function ***
       await deleteHabitById(id);

       // Update local state immediately on success
       setHabits(prevHabits => prevHabits.filter(habit => habit.id !== id));

     } catch (err: unknown) {
       // Catch errors thrown by the service function
       console.error('Component Error: Deleting habit failed:', err);
       // Set error state for the UI
       setError(err instanceof Error ? err.message : 'Failed to delete the habit.');
       // Optional: Refetch habits here if delete fails to ensure UI consistency
       // fetchHabits();
     }
  };

  // *** RESTORED Implementation ***
  // Memoized Grouping of Habits by Timing
  const groupedHabits = useMemo(() => {
    if (!Array.isArray(habits)) { return {}; }
    const groups: { [key in HabitTiming]?: Habit[] } = {};
    // Use the enum-based timingGroups array here
    for (const timing of timingGroups) {
        groups[timing] = habits.filter(h => h.timing === timing);
    }
    return groups;
  }, [habits]);

  // --- Save Order Action (Uses Service) ---
  const saveNewOrder = async (reorderedGroup: Habit[]) => {
    setError(null); // Clear previous errors

    // 1. Extract just the IDs in the new order
    const orderedIds = reorderedGroup.map(habit => habit.id);

    // 2. Check if there's anything to save
    if (orderedIds.length === 0) {
        console.log("No habits in the reordered group to save.");
        return;
    }

    console.log("Component: Attempting to save new order via service:", orderedIds);
    // Consider adding a saving/loading state specific to reordering?

    try {
        // 3. *** Call the service function ***
        await updateHabitOrder(orderedIds);

        console.log("Component: Successfully saved new order via service.");
        // Optional: Add user feedback like a success toast/message

    } catch (err: unknown) {
      // 4. Catch errors thrown by the service function
      console.error('Component Error: Saving habit order failed:', err);
      // Set error state for the UI
      setError(err instanceof Error ? err.message : 'Failed to save the new habit order.');
      // Optional: Revert the optimistic UI update by refetching
      // fetchHabits();
    }
  };

  // *** RESTORED Implementation ***
  // --- Drag End Handler ---
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    if (!Array.isArray(habits)) return;

     const activeHabit = habits.find(h => h.id === active.id);
     const overHabit = habits.find(h => h.id === over.id);

     // Ensure drag happens within the same timing group
     if (!activeHabit || !overHabit || activeHabit.timing !== overHabit.timing) {
       return;
     }

     const currentTimingGroup = activeHabit.timing; // This is a HabitTiming enum member

    // Optimistic UI Update
    setHabits((prevHabits) => {
        if (!Array.isArray(prevHabits)) return [];
        const currentGroupItems = prevHabits.filter(h => h.timing === currentTimingGroup);
        const oldIndex = currentGroupItems.findIndex((h) => h.id === active.id);
        const newIndex = currentGroupItems.findIndex((h) => h.id === over.id);

        if (oldIndex === -1 || newIndex === -1) return prevHabits;

        const reorderedGroup = arrayMove(currentGroupItems, oldIndex, newIndex);

        // Call the updated saveNewOrder function in the background
        saveNewOrder(reorderedGroup); // Pass the reordered group

        // Reconstruct the full habits array for immediate UI update
        const newHabitsArray: Habit[] = [];
        // Use the enum-based timingGroups array here too
        timingGroups.forEach(timing => {
            if (timing === currentTimingGroup) {
                newHabitsArray.push(...reorderedGroup);
            } else {
                newHabitsArray.push(...prevHabits.filter(h => h.timing === timing));
            }
        });
        return newHabitsArray;
    });
  }

  // *** RESTORED Implementation ***
  // --- Conditional Rendering ---
  if (loading) {
    return <div className="py-4 text-center text-gray-500">Loading habits...</div>;
  }

  // *** RESTORED Implementation ***
  if (!loading && habits.length === 0 && !error) {
     return (
       <div className="text-center py-10 px-6 bg-gray-50 rounded-lg mt-6">
         <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"> <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> </svg>
         <h3 className="mt-2 text-sm font-semibold text-gray-900">No habits yet</h3>
         <p className="mt-1 text-sm text-gray-500">Add your first habit using the form above.</p>
       </div>
     );
  }

  // *** RESTORED Implementation ***
  // --- Main Render Output ---
  return (
    <div className="mt-6">
      <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Your Habits</h3>
      {/* Error Display Area */}
      {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 my-4 rounded-md shadow" role="alert">
              <p className="font-semibold">Error</p>
              <p>{error}</p>
              {/* Optional: Add a retry button */}
              {/* <button onClick={fetchHabits} className="mt-2 text-sm font-medium text-red-800 hover:text-red-600">Retry</button> */}
          </div>
      )}

      {/* Drag and Drop Context Provider */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        {/* Iterate over the defined timing groups to render sections */}
        {timingGroups.map((timing) => {
          // Safely access the habits for the current group, default to empty array
          const currentGroupHabits = groupedHabits?.[timing] || [];
          // Get just the IDs for the SortableContext items prop
          const habitIds = currentGroupHabits.map(h => h.id);

          // Don't render a section if there are no habits for this timing
          if (currentGroupHabits.length === 0) return null;

          // Render the section for the current timing group
          return (
            <div key={timing} className="mb-8">
              {/* Group Header */}
              <div className="pb-2 mb-2 border-b-2 border-gray-300">
                 <h4 className="text-md font-semibold text-gray-700">{getTimingLabel(timing)} Habits</h4>
              </div>
              {/* Sortable Context for this group */}
              <SortableContext items={habitIds} strategy={verticalListSortingStrategy}>
                {/* List container */}
                <ul role="list" className="-my-5 divide-y divide-gray-200">
                  {/* Map over habits in this group */}
                  {currentGroupHabits.map((habit) => (
                    // Render the SortableHabitItem component
                    <SortableHabitItem
                      key={habit.id} // Use habit's unique ID as key
                      habit={habit}
                      onEdit={onEdit}
                      onDelete={deleteHabit} // Pass the delete handler
                    />
                  ))}
                </ul>
              </SortableContext>
            </div>
          );
        })}
      </DndContext>
    </div>
  ); // End main return
} // End HabitList component
