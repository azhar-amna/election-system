# Electys

**Live:** [https://electys.vercel.app/](https://electys.vercel.app/)

Electys is a full-stack Election Management System built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, and **Supabase** (PostgreSQL, Auth, Storage, and Realtime). It provides public live election tallies, CNIC-based voter onboarding with administrative approval, encrypted single-use ballot casting, and a full operations console for election administrators.

## Features

- **Public Live Election Results (`/`)**
  - Open to everyone with no login required.
  - Defaults to the current `ACTIVE` election (falling back to the latest `CLOSED` election) with election, region, and polling station filters.
  - Subscribes to Supabase Realtime `postgres_changes` on `public.result` so vote counts, rankings, and percentage bars update live automatically.

- **Voter Onboarding & Verification (`/register`, `/dashboard`)**
  - Public registration is strictly for voters using **CNIC** (`12345-1234567-1`), **Email**, and **Password**.
  - Voters complete their personal and constituency profile on `/dashboard` (`name`, `gender`, `dob`, `phone_no`, `province`, `district`, `region_id`).
  - Status tracking across `Profile Incomplete`, `Pending Admin Approval`, `Registration Rejected` (with admin feedback and resubmission), and `Approved & Verified Voter`.

- **Encrypted Single-Use Ballot (`/ballot`)**
  - Locked until `profile_completed === true`, `approval_status === 'APPROVED'`, and an `ACTIVE` election exists.
  - Voters choose their polling station and one candidate, confirm irreversibility in a modal, and submit exclusively through the PostgreSQL `cast_vote` RPC (`p_election_id`, `p_candidate_id`, `p_station_id`).
  - Once cast, voters see a permanent anonymous confirmation card (`Encrypted Ballot Recorded`) that never reveals their candidate choice.

- **Admin Console (`/admin`)**
  - Provisioned via Supabase Auth `app_metadata.role === 'admin'` (no public admin sign-up).
  - **Overview (`/admin`)**: Pending Voters, Approved Voters, Total Candidates, and Active Election KPIs.
  - **Voter Approvals (`/admin/voters`)**: Filterable tabs (`Pending Review`, `Approved`, `Rejected`, `All`), CNIC/name/email search, profile inspection drawer, one-click approve, reject with reason, manual voter entry, and delete with confirmation.
  - **Elections & Setup (`/admin/elections`)**: Manage elections (`DRAFT` / `ACTIVE` / `CLOSED`), regions, polling stations, political parties, and election symbols (raster image uploads to the `election-symbols` Supabase Storage bucket).
  - **Candidates (`/admin/candidates`)**: View, filter, add, and delete candidates with party affiliation and symbol thumbnails.

## Security Architecture

- **Role-Based Route Protection**: Server-verified via `supabase.auth.getUser()` and `app_metadata.role === 'admin'` in [`src/proxy.ts`](src/proxy.ts) and every protected Server Component.
- **Ballot Secrecy & Immutability**: Clients never query or insert directly into `public.vote` or `public.election_turnout`, and never write directly to `public.result`. Ballots are recorded atomically via `supabase.rpc('cast_vote', ...)` and enforced by PostgreSQL RLS and triggers.
- **Input & Upload Hardening**: Strict positive-integer, CNIC, email, phone, and date validation in [`src/lib/validation.ts`](src/lib/validation.ts), raster-only (`PNG`, `JPG`, `WebP`) symbol uploads, and sanitized error handling on public/voter routes.

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack, Cache Components)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS v4 (Obsidian Black & Emerald Green theme)
- **Icons:** Lucide React
- **Backend:** Supabase (`@supabase/ssr`, `@supabase/supabase-js`, PostgreSQL, Auth, Storage, Realtime)
- **Hosting:** Vercel — [https://electys.vercel.app/](https://electys.vercel.app/)

## Routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Public | Live election results scoreboard (Realtime) |
| `/register` | Public | Voter-only registration (CNIC, Email, Password) |
| `/login` | Public | Unified Voter & Admin sign-in |
| `/dashboard` | Voter | Profile completion & approval status |
| `/ballot` | Approved Voter | Encrypted single-use voting booth |
| `/admin` | Admin | Operational KPIs & election summary |
| `/admin/voters` | Admin | Voter inspection, approval, rejection & registry |
| `/admin/elections` | Admin | Elections, regions, stations, parties & symbols |
| `/admin/candidates` | Admin | Candidate roster management |

## Local Development

### Prerequisites

- Node.js 22+
- A Supabase project configured with the Electys PostgreSQL schema (`region`, `polling_station`, `employee`, `election`, `political_party`, `election_symbol`, `voter`, `candidate`, `election_turnout`, `vote`, `security`, `result`), RLS policies, `cast_vote` RPC, Realtime enabled on `public.result`, and a public `election-symbols` Storage bucket.

### Setup

1. Clone the repository and install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` in the project root:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
   ```

   *(Legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` is also supported as a fallback. Never expose `SUPABASE_SERVICE_ROLE_KEY` in client code or `NEXT_PUBLIC_*` variables.)*

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Build for production:

   ```bash
   npm run build
   npm run start
   ```

## Scripts

- `npm run dev` — Start local development server
- `npm run build` — Build production bundle
- `npm run start` — Serve production build
- `npm run lint` — Run ESLint
