# Jo App - Personal Growth & Habit Tracker

## 1. Project Overview

Jo App is a personal well-being and habit-tracking application designed to help users build positive daily habits (particularly focused on startup and shutdown routines), track mood and sleep, and reflect on their progress through simple, consistent check-ins and weekly reports.

**Current Stage:** Minimum Viable Product (MVP) with core functionality implemented.
**Long-Term Vision:** To evolve into a comprehensive self-growth manual/dashboard promoting intentional technology usage and living.
**Target Audience:** Individuals interested in personal growth, habit formation, self-awareness, and structured daily routines.

## 2. LLM Assistant Instructions

**(For AI Assistants Collaborating on this Project)**

**Your Role:** You are an expert programming assistant.
**User Context:** You are collaborating with Nic, who is learning programming while building this application. Patience, clarity, and detailed explanations are key.
**Collaboration Process:**
    1.  **Understand the Goal:** Start each session by confirming the objective based on the latest README Session Log and Nic's input.
    2.  **Explain Before Coding:** Before providing code changes, explain the *why* (the problem being solved) and the *how* (the proposed logic/approach). Clearly explain relevant concepts, libraries, or functions.
    3. **Provide Confidence Levels:** Ensure that any changes are recommended with confidence levels that this particular change will lead to success.
    3.  **Provide Context with Code:** When suggesting code, include:
        * **Comments:** Explain the code inline.
        * **Robustness Context:** Indicate if the approach is standard or experimental.
        * **Assumptions:** State any assumptions made about existing code.
        * **Potential Edge Cases:** Highlight limitations or scenarios needing testing.
    4.  **Prioritize Learning:** Encourage questions and be prepared to elaborate or discuss alternatives.
    5.  **Update README:** At the end of each significant work session, collaboratively update the "Session Log / Handoff Section" below with a summary of changes, status, and next steps.
    6.  **Git Workflow:** Assume changes will be committed frequently using Git best practices (clear commit messages).
    7. FINAL NOTES: Be short, but also concise. Don't leave anything out, but don't over pontificate. 

## 3. Tech Stack

* **Framework:** Next.js (v14.2.4 - App Router)
* **Language:** TypeScript (v5.4.5)
* **Backend & Database:** Supabase (Authentication, PostgreSQL DB, Edge Functions)
* **Edge Function Runtime:** Deno
* **Styling:** Tailwind CSS (v3.4.14)
* **State Management:** Zustand (v5.0.3)
* **UI / Components:**
    * React (v18.2.0)
    * Heroicons (v2.2.0)
    * Recharts (v2.15.2) - For data visualization
    * @dnd-kit (v6.3.1, v10.0.0) - For drag-and-drop functionality (likely for habit ordering)
* **Utilities:**
    * date-fns (v4.1.0) - For date manipulation
    * Geist Font
* **Linting:** ESLint (v8.x) with `eslint-config-next` (v14.2.4)
* **Package Manager:** npm

*(Note: Twilio API mentioned in documentation for SMS, but not listed in package.json dependencies. Confirm if integrated.)*

## 4. File Map / Directory Structure Overview



├── .next/ # Next.js build output (Gitignored)
├── node_modules/ # Project dependencies (Gitignored)
├── public/ # Static assets (images, icons)
├── src/ # Main application source code
│ ├── app/ # Next.js App Router: Pages, Layouts, API Routes
│ │ ├── api/ # API route handlers (e.g., Supabase auth callback)
│ │ ├── auth/ # Authentication pages (signin, signup)
│ │ ├── dashboard/ # Main user dashboard page
│ │ ├── habits/ # Habit management page
│ │ ├── settings/ # User settings page
│ │ ├── shutdown/ # Evening check-in sequence page
│ │ ├── startup/ # Morning check-in sequence page
│ │ ├── weekly-report/ # Weekly summary page (with week selector & report display)
│ │ ├── globals.css # Global styles
│ │ ├── layout.tsx # Root layout component
│ │ └── page.tsx # Landing page component
│ ├── components/ # Reusable React components
│ │ ├── common/ # General components (ErrorBanner, LoadingOverlay)
│ │ ├── daily-log/ # Components related to daily logging
│ │ ├── habits/ # Habit-specific components (Form, List)
│ │ ├── layout/ # Layout components (Header)
│ │ ├── shutdown/ # Step components for the shutdown sequence
│ │ └── startup/ # Step components for the startup sequence
│ ├── lib/ # Core logic, utilities, external service clients
│ │ ├── hooks/ # Custom React hooks
│ │ ├── supabase/ # Supabase client setup & data access functions
│ │ └── utils/ # General utility functions (e.g., dateUtils)
│ ├── stores/ # Global state management (Zustand)
│ └── types/ # TypeScript type definitions (custom & Supabase generated)
├── supabase/ # Supabase specific configuration and functions
│ ├── functions/ # Supabase Edge Functions (e.g., reminders)
│ └── config.toml # Supabase project configuration
├── .env.local # Local environment variables (Gitignored)
├── .gitignore # Specifies intentionally untracked files
├── middleware.ts # Next.js middleware (e.g., route protection)
├── next.config.js # Next.js configuration file
├── package.json # Project metadata and dependencies
├── tailwind.config.js # Tailwind CSS configuration
└── tsconfig.json # TypeScript configuration
## 5. Setup Instructions(Not needed for every session) 

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd jo-app # Or your repository directory name
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Set up Environment Variables:**
    * Create a file named `.env.local` in the root directory.
    * Add your Supabase project URL and Anon key:
        ```
        NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
        NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
        # Add NEXT_PUBLIC_BASE_URL if needed for API routes/redirects, especially in production/preview deployments
        # NEXT_PUBLIC_BASE_URL=http://localhost:3000
        ```
    * *(Note: If using Twilio for SMS, add relevant API keys/tokens here as well, ensuring they are prefixed appropriately if needed client-side, or kept server-only)*
4.  **Set up Supabase:**
    * Ensure your Supabase project has the necessary tables (`habits`, `daily_logs`, `profiles` etc.) and RLS (Row Level Security) policies configured.
    * If using Supabase Edge Functions, deploy them using the Supabase CLI.

## 6. API Key Handling

* **NEVER commit API keys or secrets directly into the Git repository.**
* All secrets (Supabase URL/Keys, Twilio Keys, etc.) must be stored in the `.env.local` file.
* The `.gitignore` file is configured to ignore `.env.local`, preventing accidental commits.
* For production deployments (e.g., Vercel), configure environment variables securely through the hosting provider's interface.

## 7. Running the Application

To run the development server:

```bash
npm run dev


Open http://localhost:3000 in your browser.
Other available scripts (see package.json):
npm run build: Creates a production build.
npm run start: Starts the production server (requires npm run build first).
npm run lint: Runs ESLint to check for code quality issues.#

## 8. Current Status (as of 2025-04-27)
* Core MVP features implemented: Habit definition & tracking, AM/PM check-in sequences, basic weekly report display, user authentication (Supabase), settings page (profile info, notification opt-in).'
*  Weekly Report page significantly enhanced: Features a dynamic week selector UI, calculates week statuses (unavailable, past, current, future), loads historical reports, and displays a pending state for the current week. Qualitative review section redesigned with card layout.
* Build Stability: The application builds successfully with Next.js v14.2.4 after resolving previous dependency and type issues.
* Backend: Supabase handles authentication, database storage, and edge functions (e.g., for reminders - confirm implementation status).
* Codebase: Committed to the main branch. Refactored to use @supabase/ssr and @supabase/supabase-js.
* Immediate Focus: UI/UX improvements (error handling consistency, responsiveness, visual feedback, accessibility) and type definition refinement (DailyLog).

## 9. Goals / Roadmap
* Ask nicolas

## 10. Session Log / Handoff Section
* Session Log Template (Copy and fill this for each session):
---
## Session Summary [YYYY-MM-DD]

**Goal:** *Briefly state the objective for this session.*

**Key Changes:**
* Bullet points detailing specific code changes, features added, bugs fixed.
* Reference file names (`file.py`) or functions (`function_name()`) where applicable.
* Example: Added user authentication using library X (see `auth.py`).

**Current Application Status:** *Brief summary after the session's changes.*

**Dependencies Added/Changed:** *List any new libraries or updated versions.*

**Next Steps / Open Issues:** *What's planned for the next session, or any known bugs/questions.*
---


(Add New Session Logs Below This Line)
(Initial log based on setup)
Session Summary [2025-04-27]
Goal: Establish a comprehensive README.md for project context, continuity, and onboarding LLM assistants. Prepare for Git workflow review.
Key Changes:
Drafted a new README.md incorporating:
Project Overview & Vision
Detailed LLM Assistant Instructions & Collaboration Process
Current Tech Stack (based on package.json and docs)
File Structure Overview
Setup & Running Instructions
API Key Handling Best Practices
Current Project Status
Short & Long-Term Goals/Roadmap
Session Log Template & Initial Log Entry
Current Application Status: MVP features implemented, build stable on Next.js 14.2.4. Ready for UI improvements and potential feature verification (SMS). Codebase reflects fixes from previous sessions (dependency/type issues resolved).
Dependencies Added/Changed: None in this session.
Next Steps / Open Issues:
Review and finalize this README.md.
Proceed with Git workflow: review local changes, stage, commit, and push.
Test the handoff process by starting


---
## Session Summary [2025-04-27]

**Goal:** Enhance the Weekly Report page (`src/app/weekly-report/page.tsx`) by adding a week selection UI, calculating week statuses, and refining the layout.

**Key Changes:**
* Refactored data fetching to separate initial user/first log date fetch from specific report fetch.
* Added state management for `user`, `firstLogDate`, `selectedWeekStartDate`, `yearWeeks`, `reportLoading`, `reportError`, `showPendingMessage`.
* Implemented `useEffect` hooks to calculate week statuses (Unavailable, Future, Past Completed, Latest Completed, Current In-Progress) based on `firstLogDate` and current date.
* Created a dynamic week selector UI displaying weeks of the current year as styled buttons based on their status.
    * Latest completed week uses distinct styling (emerald green).
    * Current week uses distinct styling (dashed yellow border).
* Made the current week clickable, showing a "Report In Progress" placeholder instead of fetching data.
* Updated report data fetching logic to trigger based on `selectedWeekStartDate` state.
* Redesigned the "Qualitative Review" section using a 3-card layout and styled tags for better visual presentation.
* Resolved TypeScript build error (`Type 'null' is not assignable to type 'Date'`) by adding explicit typing.
* Fixed runtime `RangeError` caused by incorrect date format strings.

**Current Application Status:** Weekly Report page now displays a functional week selector, loads data for the selected completed week, shows a pending state for the current week, and features an improved qualitative review layout. Build is stable.

**Dependencies Added/Changed:** None.

**Next Steps / Open Issues:**
* Consider further UI/UX refinements for the week selector or report content if desired.
* (Deferred) Implement user setting for weekly report availability time (Sunday/Monday).
* (Deferred) Implement weekly cover photo upload/display feature.
* (Deferred) Add year navigation to the weekly report selector.
---


---
## Session Summary [2025-04-28]

**Goal:** Resolve issues with non-functional Shutdown and Weekly Report SMS reminders. Add a new Midday reminder for "Anytime" habits.

**Key Changes:**
* **Diagnosed Invocation Failure:** Identified that `pg_cron` jobs were using the public `anon` key for authorization, preventing the `send-shutdown-reminders` and `send-weekly-report-notifications` functions from executing, despite the cron job run status showing 'succeeded'.
* **Fixed Cron Job Authorization:** Updated the `cron.schedule` commands for all three reminder jobs (`startup`, `shutdown`, `weekly-report`) via SQL to use the `SERVICE_ROLE_KEY` in the `Authorization: Bearer` header. This resolved the invocation failures. (See `SQL Script to Update Cron Jobs`).
* **Corrected Weekly Report Day Logic:** Fixed the `calculateLocalDayAndHour` function in `supabase/functions/send-weekly-report-notifications/index.ts` to use `'short'` weekday format instead of `'narrow'` to prevent potential day miscalculations. Deployed the fix using `supabase functions deploy`.
* **Added Midday Reminder Column:** Added `midday_reminder_sent_at` (TIMESTAMPTZ, nullable) column to the `daily_logs` table via SQL.
* **Created Midday Reminder Function:**
    * Created new Edge Function `supabase/functions/send-midday-reminders/index.ts`.
    * Logic fetches users eligible based on `TARGET_MIDDAY_HOUR = 12` (12 PM local time).
    * Checks `daily_logs.midday_reminder_sent_at` to prevent duplicates.
    * Fetches habits where `timing = 'Anytime'`.
    * Constructs and sends an SMS listing the "Anytime" habits via Twilio.
    * Updates `daily_logs.midday_reminder_sent_at` on successful send.
* **Scheduled Midday Reminder:** Added a new `pg_cron` job (`invoke-midday-reminder`) scheduled to run every 15 minutes (`*/15 * * * *`) using the `SERVICE_ROLE_KEY`.
* **Deployed Midday Reminder:** Deployed the new function using `supabase functions deploy send-midday-reminders --no-verify-jwt` after fixing initial syntax errors.
* **Verified Invocations:** Confirmed via Supabase function logs that `send-shutdown-reminders` and `send-midday-reminders` are now being invoked correctly by their respective cron jobs.

**Current Application Status:**
* Startup, Shutdown, and Midday reminder functions are now being correctly invoked by their respective cron jobs every 15 minutes.
* Shutdown reminder logic is confirmed to be running, awaiting the correct local time (8 PM) to send.
* Weekly report reminder logic is corrected and deployed, awaiting Sunday to run.
* Midday reminder function is deployed and invoking, awaiting the correct local time (12 PM) to send.

**Dependencies Added/Changed:** None.

**Next Steps / Open Issues:**
* Monitor `send-midday-reminders` function logs and SMS delivery tomorrow (Tuesday) around 12 PM local time.
* Monitor `send-shutdown-reminders` function logs and SMS delivery tonight/daily around 8 PM local time.
* Monitor `send-weekly-report-notifications` function logs and SMS delivery this Sunday around 9 AM local time.
* (Deferred) Implement user settings for customizing reminder times/days.
* (Deferred) Review SMS message content for any desired changes (e.g., adding the app URL if needed).
---
---
## Session Summary [2025-04-29]

**Goal:** Enhance the Weekly Report page UI/UX, focusing on the week selector and habit completion visualization.

**Key Changes:**
* **Week Selector Order:** Fixed the week selector button order to display chronologically (1, 2, 3...). Adjusted logic to handle Week 1 starting in the previous calendar year correctly. (`src/app/weekly-report/page.tsx` - Effect 3)
* **Week Selector Status:** Corrected the status calculation logic (`UNAVAILABLE`, `PAST_COMPLETED`, etc.) to accurately reflect the user's `firstLogDate` and handle the week containing Jan 1st. (`src/app/weekly-report/page.tsx` - Effect 3)
* **Habit Completion UI:**
    * Replaced check/cross icons with solid colored blocks (`bg-green-200`, `bg-red-200`, `bg-gray-100`) filling the table cells for daily completion status in "Completion Summary" and "Habit Consistency" tables. (`src/app/weekly-report/page.tsx` - JSX Tables)
    * Adjusted table cell padding (`py-2`) and added fixed height (`h-6`) to status cells for a more compact look.
    * Implemented `table-fixed` layout with `<colgroup>` to ensure uniform width for daily status columns.
    * Experimented with different color shades and border styles (`border-separate` vs `border-collapse`) to refine visual appearance and spacing. Final iteration uses `border-collapse` with explicit bottom borders on text cells and white borders on status cells.
* **Date Formatting:** Fixed `RangeError` related to date formatting by changing `'MMMM do'` and `'YYYY'` to `'MMMM d'` and `'yyyy'` respectively in `format` calls. (`src/app/weekly-report/page.tsx`)
* **Sticky Navigation (Deferred):** Added logic and initial JSX for sticky previous/next week navigation arrows using Heroicons, but implementation was paused due to table styling conflicts. (`src/app/weekly-report/page.tsx`)

**Current Application Status:**
* Weekly Report page displays weeks correctly ordered and with accurate status coloring based on the user's history.
* Habit/Routine completion is visualized using a grid of uniformly sized, colored blocks with subtle white borders separating them and standard row dividers.
* Build is stable (excluding the incomplete sticky navigation feature).

**Dependencies Added/Changed:** Added `@heroicons/react` (`v2.1.3` or similar, check `package.json`) for the (deferred) sticky navigation arrows feature.

**Next Steps / Open Issues:**
* Finalize and test sticky navigation arrows for previous/next week navigation (paused).
* Review and potentially further refine the table styling/borders for the completion grids if desired.
* (Deferred from previous) Implement user setting for weekly report availability time (Sunday/Monday).
* (Deferred from previous) Implement weekly cover photo upload/display feature.
* (Deferred from previous) Add year navigation to the weekly report selector.
---
