// src/types/supabase.ts
export type Database = {
    public: {
      Tables: {
        daily_logs: {
          Row: {
            id: string;
            user_id: string;
            log_date: string;
            prev_evening_rating: number | null;
            sleep_rating: number | null;
            morning_rating: number | null;
            day_rating: number | null;
            feeling_morning: string | null;
            accomplishment: string | null;
            improvement: string | null;
            completed_am_habits: string[];
            completed_pm_anytime_habits: string[];
            deferred_from_startup: string[] | null;
            deferred_from_shutdown: string[] | null;
            startup_completed_at: string | null;
            shutdown_completed_at: string | null;
            created_at: string;
            updated_at: string;
          };
          Insert: {
            id?: string;
            user_id: string;
            log_date: string;
            prev_evening_rating?: number | null;
            sleep_rating?: number | null;
            morning_rating?: number | null;
            day_rating?: number | null;
            feeling_morning?: string | null;
            accomplishment?: string | null;
            improvement?: string | null;
            completed_am_habits?: string[];
            completed_pm_anytime_habits?: string[];
            deferred_from_startup?: string[] | null;
            deferred_from_shutdown?: string[] | null;
            startup_completed_at?: string | null;
            shutdown_completed_at?: string | null;
            created_at?: string;
            updated_at?: string;
          };
          Update: {
            id?: string;
            user_id?: string;
            log_date?: string;
            prev_evening_rating?: number | null;
            sleep_rating?: number | null;
            morning_rating?: number | null;
            day_rating?: number | null;
            feeling_morning?: string | null;
            accomplishment?: string | null;
            improvement?: string | null;
            completed_am_habits?: string[];
            completed_pm_anytime_habits?: string[];
            deferred_from_startup?: string[] | null;
            deferred_from_shutdown?: string[] | null;
            startup_completed_at?: string | null;
            shutdown_completed_at?: string | null;
            created_at?: string;
            updated_at?: string;
          };
        };
      };
      Functions: {
        get_today_log_for_user: {
          Args: { p_user_id: string };
          Returns: {
            id: string;
            user_id: string;
            log_date: string;
            prev_evening_rating: number | null;
            sleep_rating: number | null;
            morning_rating: number | null;
            day_rating: number | null;
            feeling_morning: string | null;
            accomplishment: string | null;
            improvement: string | null;
            completed_am_habits: string[];
            completed_pm_anytime_habits: string[];
            deferred_from_startup: string[] | null;
            deferred_from_shutdown: string[] | null;
            startup_completed_at: string | null;
            shutdown_completed_at: string | null;
            created_at: string;
            updated_at: string;
          };
        };
      };
    };
  };