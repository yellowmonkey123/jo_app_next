'use client';
import React, { useEffect, useState, useMemo } from 'react';
import { Habit, HabitTiming } from '@/types';
import { getHabitsForUser, deleteHabitById, updateHabitOrder } from '@/lib/supabase/habits';
import { getSupabaseClient } from '@/lib/supabase/supabaseClient';
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
import { Bars3Icon } from '@heroicons/react/24/solid';

interface HabitListProps {
  onEdit: (habit: Habit) => void;
  refreshKey: number;
}

const timingGroups: HabitTiming[] = [HabitTiming.AM, HabitTiming.ANYTIME, HabitTiming.PM];

const getTimingLabel = (timing: HabitTiming): string => {
  switch (timing) {
    case HabitTiming.AM: return 'Morning';
    case HabitTiming.PM: return 'Evening';
    case HabitTiming.ANYTIME: return 'Anytime';
    default:
      const exhaustiveCheck: never = timing;
      return String(timing);
  }
};

const getTimingColor = (timing: HabitTiming): string => {
  switch (timing) {
    case HabitTiming.AM: return 'bg-yellow-100 text-yellow-800';
    case HabitTiming.PM: return 'bg-blue-100 text-blue-800';
    case HabitTiming.ANYTIME: return 'bg-green-100 text-green-800';
    default:
      const exhaustiveCheck: never = timing;
      return 'bg-gray-100 text-gray-800';
  }
};

interface SortableHabitItemProps {
  habit: Habit;
  onEdit: (h: Habit) => void;
  onDelete: (id: string) => void;
}

function SortableHabitItem({ habit, onEdit, onDelete }: SortableHabitItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: habit.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 10 : 'auto',
    boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
    backgroundColor: isDragging ? 'white' : 'transparent',
  };

  return (
    <li ref={setNodeRef} style={style} className="py-4 flex items-center space-x-2 bg-white" {...attributes}>
      <button
        {...listeners}
        className="cursor-grab touch-none rounded text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 flex items-center justify-center p-1"
        aria-label={`Drag handle for ${habit.name}`}
      >
        <Bars3Icon className="w-5 h-5" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{habit.name}</p>
        <p className="text-sm text-gray-500">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTimingColor(habit.timing)}`}>
            {getTimingLabel(habit.timing)}
          </span>
        </p>
      </div>
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

export default function HabitList({ onEdit, refreshKey }: HabitListProps) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    fetchHabits();
  }, [refreshKey]);

  const fetchHabits = async () => {
    const supabase = getSupabaseClient();
    try {
      setLoading(true);
      setError(null);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw new Error(`Authentication error: ${userError.message}`);
      if (!user) {
        console.warn("HabitList: No authenticated user found.");
        setHabits([]);
        setLoading(false);
        return;
      }

      const fetchedHabits = await getHabitsForUser(user.id);
      setHabits(fetchedHabits);
    } catch (err: unknown) {
      console.error('Component Error: Fetching habits failed:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred while loading habits.');
      setHabits([]);
    } finally {
      setLoading(false);
    }
  };

  const deleteHabit = async (id: string) => {
    if (!confirm('Are you sure you want to delete this habit? This action cannot be undone.')) {
      return;
    }
    try {
      setError(null);
      await deleteHabitById(id);
      setHabits(prevHabits => prevHabits.filter(habit => habit.id !== id));
    } catch (err: unknown) {
      console.error('Component Error: Deleting habit failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete the habit.');
    }
  };

  const groupedHabits = useMemo(() => {
    if (!Array.isArray(habits)) { return {}; }
    const groups: { [key in HabitTiming]?: Habit[] } = {};
    for (const timing of timingGroups) {
      groups[timing] = habits.filter(h => h.timing === timing);
    }
    return groups;
  }, [habits]);

  const saveNewOrder = async (reorderedGroup: Habit[]) => {
    setError(null);
    const orderedIds = reorderedGroup.map(habit => habit.id);
    if (orderedIds.length === 0) {
      console.log("No habits in the reordered group to save.");
      return;
    }
    console.log("Component: Attempting to save new order via service:", orderedIds);
    try {
      await updateHabitOrder(orderedIds);
      console.log("Component: Successfully saved new order via service.");
    } catch (err: unknown) {
      console.error('Component Error: Saving habit order failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to save the new habit order.');
    }
  };

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    if (!Array.isArray(habits)) return;

    const activeHabit = habits.find(h => h.id === active.id);
    const overHabit = habits.find(h => h.id === over.id);

    if (!activeHabit || !overHabit || activeHabit.timing !== overHabit.timing) {
      return;
    }

    const currentTimingGroup = activeHabit.timing;

    setHabits((prevHabits) => {
      if (!Array.isArray(prevHabits)) return [];
      const currentGroupItems = prevHabits.filter(h => h.timing === currentTimingGroup);
      const oldIndex = currentGroupItems.findIndex((h) => h.id === active.id);
      const newIndex = currentGroupItems.findIndex((h) => h.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return prevHabits;

      const reorderedGroup = arrayMove(currentGroupItems, oldIndex, newIndex);
      saveNewOrder(reorderedGroup);

      const newHabitsArray: Habit[] = [];
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

  if (loading) {
    return <div className="py-4 text-center text-gray-500">Loading habits...</div>;
  }

  if (!loading && habits.length === 0 && !error) {
    return (
      <div className="text-center py-10 px-6 bg-gray-50 rounded-lg mt-6">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="mt-2 text-sm font-semibold text-gray-900">No habits yet</h3>
        <p className="mt-1 text-sm text-gray-500">Add your first habit using the form above.</p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Your Habits</h3>
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 my-4 rounded-md shadow" role="alert">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
        </div>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        {timingGroups.map((timing) => {
          const currentGroupHabits = groupedHabits?.[timing] || [];
          const habitIds = currentGroupHabits.map(h => h.id);
          if (currentGroupHabits.length === 0) return null;
          return (
            <div key={timing} className="mb-8">
              <div className="pb-2 mb-2 border-b-2 border-gray-300">
                <h4 className="text-md font-semibold text-gray-700">{getTimingLabel(timing)} Habits</h4>
              </div>
              <SortableContext items={habitIds} strategy={verticalListSortingStrategy}>
                <ul role="list" className="-my-5 divide-y divide-gray-200">
                  {currentGroupHabits.map((habit) => (
                    <SortableHabitItem
                      key={habit.id}
                      habit={habit}
                      onEdit={onEdit}
                      onDelete={deleteHabit}
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