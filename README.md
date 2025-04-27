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
│ │ ├── weekly-report/ # Weekly summary page
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
* Core MVP features implemented: Habit definition & tracking, AM/PM check-in sequences, basic weekly report display, user authentication (Supabase), settings page (profile info, notification opt-in).
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
