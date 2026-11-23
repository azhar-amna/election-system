# AGENTS.md — Election Management System (Next.js + Supabase)

## 1. Project Identity & Stack
- **Application:** Election Management System (EMS)
- **Frontend Framework:** Next.js (App Router, TypeScript, Tailwind CSS)
- **Backend / Database:** Supabase (PostgreSQL, Supabase Auth, Supabase Storage, Supabase Realtime)
- **Visual Theme:** High-contrast **Obsidian Black & Emerald Green** theme.
  - Primary background: `#090D0B` / `#0D1117` (deep black)
  - Card / elevated surfaces: `#111814` / `#161F1A` with `1px solid #1F2E26` borders
  - Primary accent: `#10B981` (Emerald 500) & `#22C55E` (Green 500) with `#052E16` dark green badges
  - Text: `#F3F4F6` primary, `#9CA3AF` muted, `#EF4444` destructive/rejected, `#F59E0B` pending/warning
  - Do NOT use default blue/purple SaaS themes. Keep UI sharp, civic, high-contrast black and green.

## 2. Strict Architecture & Security Rules (DO NOT VIOLATE)
1. **Two User Roles Only + Public Visitors:**
   - **Admin:** Provisioned manually in Supabase Auth (`app_metadata.role === 'admin'`). There is **NO public admin sign-up** anywhere in the frontend.
   - **Voter:** Signs up publicly using **3 fields ONLY**: `cnic`, `email`, and `password`.
   - **Public Visitor:** Can view `/results` (and `/`) without authentication.
2. **Voter Onboarding & Approval Gate:**
   - On sign-up (`supabase.auth.signUp`), pass `{ options: { data: { cnic } } }`. A database trigger automatically creates the `public.voter` row with `profile_completed = false` and `approval_status = 'PENDING'`.
   - After sign-up/login, the voter lands on `/dashboard` where they must **Complete Profile** (`name`, `gender`, `dob`, `phone_no`, `province`, `district`, `region_id`).
   - A voter **CANNOT** vote until `profile_completed === true` AND `approval_status === 'APPROVED'`.
   - Never allow a client-side update to modify `approval_status` to `'APPROVED'`; RLS enforces that only `is_admin()` can approve/reject voters.
3. **Secret, Immutable, One-Time Voting:**
   - **NEVER** insert directly into `public.vote`, `public.election_turnout`, or `public.result` from the frontend.
   - **ALWAYS** cast votes by calling the Postgres RPC:
     `supabase.rpc('cast_vote', { p_election_id, p_candidate_id, p_station_id })`
   - `public.vote` stores `encrypted_ballot` (`BYTEA`) with **no `voter_id` column**—nobody (not even Admin) can see who voted for whom.
   - Votes and turnout records are **immutable** (enforced by DB triggers). Once confirmed, a voter cannot edit, delete, or recast their vote in that election.
4. **Supabase Client Usage:**
   - Use `@supabase/ssr` with separate `src/lib/supabase/client.ts` (browser) and `src/lib/supabase/server.ts` (server components & server actions) plus `src/middleware.ts` for session refresh and route protection.
   - Never expose `SUPABASE_SERVICE_ROLE_KEY` in client components or `NEXT_PUBLIC_*` env vars.

## 3. Exact Database Schema Reference (Do Not Invent Columns)
- `region`: `region_id` (PK), `region_name`, `location`, `type`
- `polling_station`: `station_id` (PK), `name`, `location`, `region_id` (FK -> `region`)
- `employee`: `emp_id` (PK), `name`, `designation`, `station_id` (FK -> `polling_station`)
- `election`: `election_id` (PK), `title`, `start_date`, `end_date`, `status` (`'DRAFT' | 'ACTIVE' | 'CLOSED'`)
- `political_party`: `party_id` (PK), `party_name`, `leader`
- `election_symbol`: `symbol_id` (PK), `symbol_name`, `image_url` (public bucket: `election-symbols`)
- `voter`: `voter_id` (PK), `auth_user_id` (UUID), `email`, `cnic`, `name`, `gender`, `dob`, `phone_no`, `province`, `district`, `region_id` (FK -> `region`), `profile_completed` (bool), `approval_status` (`'PENDING' | 'APPROVED' | 'REJECTED'`), `rejection_reason`, `approved_at`, `approved_by`, `has_voted` (bool), `created_at`, `updated_at`
- `candidate`: `candidate_id` (PK), `name`, `gender`, `religion`, `party_id` (FK -> `political_party`), `symbol_id` (FK -> `election_symbol`), `region_id` (FK -> `region`), `election_id` (FK -> `election`)
- `election_turnout`: `turnout_id` (PK), `election_id` (FK), `voter_id` (FK), `voted_at` (No client SELECT)
- `vote`: `vote_id` (PK), `election_id` (FK), `station_id` (FK), `encrypted_ballot` (BYTEA), `cast_at` (No client SELECT)
- `security`: `security_id` (PK), `voter_id`, `emp_id`, `station_id`, `election_id`, `status`, `logged_at`
- `result`: `result_id` (PK), `election_id` (FK), `candidate_id` (FK), `station_id` (FK), `total_votes` (int, Realtime enabled)

## 4. Coding & UX Standards
- Use TypeScript strict types matching the schema above (`src/types/database.ts`).
- Always show clear loading skeletons, empty states, and toast/banner error handling.
- Before calling `cast_vote`, show an explicit confirmation modal warning: *"Once submitted, your encrypted ballot is permanent and cannot be changed."*
- Subscribe to `postgres_changes` on `public.result` in the public `/results` page so vote counts update live without page refresh.