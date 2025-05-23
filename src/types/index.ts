// User type from Supabase Auth
export type User = {
    id: string;
    email: string;
    created_at: string;
  };
  
  // Habit timing enum
  export enum HabitTiming {
    AM = 'AM',
    PM = 'PM',
    ANYTIME = 'ANYTIME'
  }
  
 
  export interface StartupFormData {
    prev_evening_rating: Rating | null;
    sleep_rating: Rating | null;
    morning_rating: Rating | null;
    feeling_morning: string;
    completed_am_habits: string[]; // Array of completed habit IDs
  }

  export interface ShutdownFormData {
    day_rating: Rating | null;
    accomplishment: string;
    improvement: string;
    completed_pm_anytime_habits: string[]; // Array of completed habit IDs
  }
  

  // Habit type
  export type Habit = {
    id: string;
    user_id: string;
    name: string;
    timing: HabitTiming;
    created_at: string;
    sort_order: number | null;
  };
  
  // Rating type (1-5 scale)
  export type Rating = 1 | 2 | 3 | 4 | 5;
  
  // Daily Log type
  export type DailyLog = {
    id: string;
    user_id: string;
    log_date: string;
    
    // Ratings
    prev_evening_rating?: Rating;
    sleep_rating?: Rating;
    morning_rating?: Rating;
    day_rating?: Rating;
    
    // Text responses
    feeling_morning?: string;
    accomplishment?: string;
    improvement?: string;
    
    // Habit tracking
    completed_am_habits: string[];
    completed_pm_anytime_habits: string[];

    // Deferred habits
    deferred_from_startup?: string[] | null; // Array of habit IDs deferred from startup
    deferred_from_shutdown?: string[] | null; // Array of habit IDs deferred from shutdown
    
    // Completion timestamps
    startup_completed_at?: string;
    shutdown_completed_at?: string;
    
    created_at: string;
    updated_at: string;
  };
  
  // Step types for the multi-step form process
  export enum StartupStep {
    PREV_EVENING_RATING = 'prev-evening-rating',
    SLEEP_RATING = 'sleep-rating',
    MORNING_RATING = 'morning-rating',
    FEELING = 'feeling',
    AM_HABITS = 'am-habits'
  }
  
  export enum ShutdownStep {
    DAY_RATING = 'day-rating',
    ACCOMPLISHMENT = 'accomplishment',
    IMPROVEMENT = 'improvement',
    PM_ANYTIME_HABITS = 'pm-anytime-habits'
  }


