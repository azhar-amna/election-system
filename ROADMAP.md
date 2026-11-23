# ROADMAP.md — Election Management System (Full-Stack Build Plan)

## Phase 1: Project Initialization & Supabase Connection
- **Goal:** Scaffold Next.js App Router project with TypeScript, Tailwind CSS, Lucide icons, and `@supabase/ssr`.
- **Deliverables:**
  - `.env.local` configured with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  - `src/types/database.ts` defining exact TypeScript interfaces for all PostgreSQL tables and `cast_vote` RPC parameters.
  - `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, and `src/middleware.ts`.
  - Obsidian Black & Emerald Green design tokens in `src/app/globals.css` and shared Navbar/Layout.

## Phase 2: Authentication & Role-Based Routing
- **Goal:** Implement voter-only registration, unified/role-aware login, and middleware route guards.
- **Deliverables:**
  - `/register`: Voter sign-up form with **3 fields only** (`CNIC`, `Email`, `Password`), passing `{ data: { cnic } }` to `supabase.auth.signUp`.
  - `/login`: Sign-in form supporting both Voters and Admin (checks `user.app_metadata.role === 'admin'` to redirect Admin to `/admin` and Voters to `/dashboard`).
  - Route protection in `middleware.ts`:
    - Unauthenticated users visiting `/dashboard`, `/ballot`, or `/admin` -> redirect to `/login`.
    - Non-admin users visiting `/admin` -> redirect to `/dashboard`.
    - Admin users visiting `/dashboard` or `/ballot` -> redirect to `/admin`.

## Phase 3: Voter Dashboard & Profile Completion Flow
- **Goal:** Allow registered voters to complete their profile and track their admin approval status.
- **Deliverables:**
  - `/dashboard`: Fetches current user's `public.voter` record.
  - Status Banner displaying current state:
    1. `PROFILE INCOMPLETE` (Amber) -> prompts voter to complete profile.
    2. `PENDING ADMIN APPROVAL` (Amber) -> profile submitted, awaiting admin verification.
    3. `REJECTED` (Red) -> displays `rejection_reason` and lets voter edit & resubmit profile.
    4. `APPROVED` (Emerald Green) -> unlocks "Enter Voting Ballot" button for active elections.
  - Profile Completion Form (`name`, `gender`, `dob`, `phone_no`, `province`, `district`, `region_id` dropdown from `public.region`) setting `profile_completed = true`.

## Phase 4: Admin Dashboard (Elections, Voters, Candidates & Setup)
- **Goal:** Give the Admin complete operational control over elections, voter approvals, candidates, and lookup entities.
- **Deliverables:**
  - `/admin` Overview: KPI cards (Pending Approvals, Approved Voters, Total Candidates, Active Election status).
  - `/admin/voters`: Filterable table (`PENDING`, `APPROVED`, `REJECTED`, `ALL`); inspect CNIC & profile details; **Approve** (`approval_status = 'APPROVED'`, `approved_at = now()`, `approved_by = admin.id`), **Reject** (with reason), **Add Voter** (pre-approved or pending), and **Delete Voter**.
  - `/admin/elections`: Create elections (`title`, `start_date`, `end_date`), manage `region`, `polling_station`, `political_party`, and `election_symbol` (with image upload to `election-symbols` storage bucket), and switch election status (`DRAFT` -> `ACTIVE` -> `CLOSED`).
  - `/admin/candidates`: Add and delete candidates assigned to an `election_id`, `region_id`, `party_id`, and `symbol_id`.

## Phase 5: Encrypted Ballot Casting (`/ballot`)
- **Goal:** Provide an intuitive, tamper-proof, single-use voting booth for approved voters.
- **Deliverables:**
  - Server-side check verifying `approval_status === 'APPROVED'`, `profile_completed === true`, and an `ACTIVE` election exists.
  - Check whether the voter has already voted (via `has_voted` / server check) and show a **Ballot Cast Receipt** if already voted.
  - Candidate selection grid showing Candidate Name, Party Name, Region, and Election Symbol image, plus Polling Station selector (defaulting to a station in the voter's `region_id`).
  - Confirmation modal before calling `supabase.rpc('cast_vote', { p_election_id, p_candidate_id, p_station_id })`.

## Phase 6: Public Live Election Results (`/results` & `/`)
- **Goal:** Publicly accessible real-time election scoreboard with no login required.
- **Deliverables:**
  - Election selector dropdown (defaults to current `ACTIVE` election, falling back to latest `CLOSED` election).
  - KPI strip: Total Votes Cast, Participating Candidates, Reporting Stations, and pulsing green `LIVE` badge.
  - Candidate leaderboard sorted by votes descending with Emerald Green progress bars, percentages, party/symbol badges, and Region / Polling Station filters.
  - Supabase Realtime subscription on `public.result` (`INSERT` and `UPDATE`) to refresh tallies live.