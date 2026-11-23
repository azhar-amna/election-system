/**
 * Strict TypeScript definitions matching the exact PostgreSQL schema
 * for the Election Management System (EMS).
 *
 * Note: `election_turnout` and `vote` are intentionally omitted from
 * client-exposed table interfaces — votes are cast exclusively via the
 * `cast_vote` PostgreSQL RPC (`supabase.rpc('cast_vote', ...)`).
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ElectionStatus = "DRAFT" | "ACTIVE" | "CLOSED";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";
export type UserRole = "admin" | "voter";

// ---------------------------------------------------------------------------
// Core Table Row Interfaces (exact columns from AGENTS.md)
// ---------------------------------------------------------------------------

export interface Region {
  region_id: number;
  region_name: string;
  location: string | null;
  type: string | null;
}

export interface PollingStation {
  station_id: number;
  name: string;
  location: string | null;
  region_id: number;
}

export interface Employee {
  emp_id: number;
  name: string;
  designation: string | null;
  station_id: number | null;
}

export interface Election {
  election_id: number;
  title: string;
  start_date: string;
  end_date: string;
  status: ElectionStatus;
}

export interface PoliticalParty {
  party_id: number;
  party_name: string;
  leader: string | null;
}

export interface ElectionSymbol {
  symbol_id: number;
  symbol_name: string;
  image_url: string | null;
}

export interface Voter {
  voter_id: number;
  auth_user_id: string | null;
  email: string;
  cnic: string;
  name: string | null;
  gender: string | null;
  dob: string | null;
  phone_no: string | null;
  province: string | null;
  district: string | null;
  region_id: number | null;
  profile_completed: boolean;
  approval_status: ApprovalStatus;
  rejection_reason: string | null;
  approved_at: string | null;
  approved_by: string | null;
  has_voted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Candidate {
  candidate_id: number;
  name: string;
  gender: string | null;
  religion: string | null;
  party_id: number | null;
  symbol_id: number | null;
  region_id: number;
  election_id: number;
}

export interface Security {
  security_id: number;
  voter_id: number | null;
  emp_id: number | null;
  station_id: number | null;
  election_id: number | null;
  status: string;
  logged_at: string;
}

export interface Result {
  result_id: number;
  election_id: number;
  candidate_id: number;
  station_id: number;
  total_votes: number;
}

// ---------------------------------------------------------------------------
// RPC Parameter Interfaces
// ---------------------------------------------------------------------------

export interface CastVoteArgs {
  p_election_id: number;
  p_candidate_id: number;
  p_station_id: number;
}

// ---------------------------------------------------------------------------
// Insert & Update Helper Types
// ---------------------------------------------------------------------------

type AsRecord<T> = { [K in keyof T]: T[K] };

type MakeOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RegionInsert = MakeOptional<
  AsRecord<Region>,
  "region_id" | "location" | "type"
>;
export type RegionUpdate = Partial<AsRecord<Region>>;

export type PollingStationInsert = MakeOptional<
  AsRecord<PollingStation>,
  "station_id" | "location"
>;
export type PollingStationUpdate = Partial<AsRecord<PollingStation>>;

export type EmployeeInsert = MakeOptional<
  AsRecord<Employee>,
  "emp_id" | "designation" | "station_id"
>;
export type EmployeeUpdate = Partial<AsRecord<Employee>>;

export type ElectionInsert = MakeOptional<
  AsRecord<Election>,
  "election_id" | "status"
>;
export type ElectionUpdate = Partial<AsRecord<Election>>;

export type PoliticalPartyInsert = MakeOptional<
  AsRecord<PoliticalParty>,
  "party_id" | "leader"
>;
export type PoliticalPartyUpdate = Partial<AsRecord<PoliticalParty>>;

export type ElectionSymbolInsert = MakeOptional<
  AsRecord<ElectionSymbol>,
  "symbol_id" | "image_url"
>;
export type ElectionSymbolUpdate = Partial<AsRecord<ElectionSymbol>>;

export type VoterInsert = MakeOptional<
  AsRecord<Voter>,
  | "voter_id"
  | "auth_user_id"
  | "name"
  | "gender"
  | "dob"
  | "phone_no"
  | "province"
  | "district"
  | "region_id"
  | "profile_completed"
  | "approval_status"
  | "rejection_reason"
  | "approved_at"
  | "approved_by"
  | "has_voted"
  | "created_at"
  | "updated_at"
>;
export type VoterUpdate = Partial<AsRecord<Voter>>;

export type CandidateInsert = MakeOptional<
  AsRecord<Candidate>,
  "candidate_id" | "gender" | "religion" | "party_id" | "symbol_id"
>;
export type CandidateUpdate = Partial<AsRecord<Candidate>>;

export type SecurityInsert = MakeOptional<
  AsRecord<Security>,
  "security_id" | "voter_id" | "emp_id" | "station_id" | "election_id" | "logged_at"
>;
export type SecurityUpdate = Partial<AsRecord<Security>>;

export type ResultInsert = MakeOptional<
  AsRecord<Result>,
  "result_id" | "total_votes"
>;
export type ResultUpdate = Partial<AsRecord<Result>>;

// ---------------------------------------------------------------------------
// Supabase Client Database Schema Definition
// ---------------------------------------------------------------------------

export interface Database {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      region: {
        Row: AsRecord<Region>;
        Insert: RegionInsert;
        Update: RegionUpdate;
        Relationships: [];
      };
      polling_station: {
        Row: AsRecord<PollingStation>;
        Insert: PollingStationInsert;
        Update: PollingStationUpdate;
        Relationships: [
          {
            foreignKeyName: "polling_station_region_id_fkey";
            columns: ["region_id"];
            isOneToOne: false;
            referencedRelation: "region";
            referencedColumns: ["region_id"];
          },
        ];
      };
      employee: {
        Row: AsRecord<Employee>;
        Insert: EmployeeInsert;
        Update: EmployeeUpdate;
        Relationships: [
          {
            foreignKeyName: "employee_station_id_fkey";
            columns: ["station_id"];
            isOneToOne: false;
            referencedRelation: "polling_station";
            referencedColumns: ["station_id"];
          },
        ];
      };
      election: {
        Row: AsRecord<Election>;
        Insert: ElectionInsert;
        Update: ElectionUpdate;
        Relationships: [];
      };
      political_party: {
        Row: AsRecord<PoliticalParty>;
        Insert: PoliticalPartyInsert;
        Update: PoliticalPartyUpdate;
        Relationships: [];
      };
      election_symbol: {
        Row: AsRecord<ElectionSymbol>;
        Insert: ElectionSymbolInsert;
        Update: ElectionSymbolUpdate;
        Relationships: [];
      };
      voter: {
        Row: AsRecord<Voter>;
        Insert: VoterInsert;
        Update: VoterUpdate;
        Relationships: [
          {
            foreignKeyName: "voter_region_id_fkey";
            columns: ["region_id"];
            isOneToOne: false;
            referencedRelation: "region";
            referencedColumns: ["region_id"];
          },
        ];
      };
      candidate: {
        Row: AsRecord<Candidate>;
        Insert: CandidateInsert;
        Update: CandidateUpdate;
        Relationships: [
          {
            foreignKeyName: "candidate_party_id_fkey";
            columns: ["party_id"];
            isOneToOne: false;
            referencedRelation: "political_party";
            referencedColumns: ["party_id"];
          },
          {
            foreignKeyName: "candidate_symbol_id_fkey";
            columns: ["symbol_id"];
            isOneToOne: false;
            referencedRelation: "election_symbol";
            referencedColumns: ["symbol_id"];
          },
          {
            foreignKeyName: "candidate_region_id_fkey";
            columns: ["region_id"];
            isOneToOne: false;
            referencedRelation: "region";
            referencedColumns: ["region_id"];
          },
          {
            foreignKeyName: "candidate_election_id_fkey";
            columns: ["election_id"];
            isOneToOne: false;
            referencedRelation: "election";
            referencedColumns: ["election_id"];
          },
        ];
      };
      security: {
        Row: AsRecord<Security>;
        Insert: SecurityInsert;
        Update: SecurityUpdate;
        Relationships: [
          {
            foreignKeyName: "security_voter_id_fkey";
            columns: ["voter_id"];
            isOneToOne: false;
            referencedRelation: "voter";
            referencedColumns: ["voter_id"];
          },
          {
            foreignKeyName: "security_emp_id_fkey";
            columns: ["emp_id"];
            isOneToOne: false;
            referencedRelation: "employee";
            referencedColumns: ["emp_id"];
          },
          {
            foreignKeyName: "security_station_id_fkey";
            columns: ["station_id"];
            isOneToOne: false;
            referencedRelation: "polling_station";
            referencedColumns: ["station_id"];
          },
          {
            foreignKeyName: "security_election_id_fkey";
            columns: ["election_id"];
            isOneToOne: false;
            referencedRelation: "election";
            referencedColumns: ["election_id"];
          },
        ];
      };
      result: {
        Row: AsRecord<Result>;
        Insert: ResultInsert;
        Update: ResultUpdate;
        Relationships: [
          {
            foreignKeyName: "result_election_id_fkey";
            columns: ["election_id"];
            isOneToOne: false;
            referencedRelation: "election";
            referencedColumns: ["election_id"];
          },
          {
            foreignKeyName: "result_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "candidate";
            referencedColumns: ["candidate_id"];
          },
          {
            foreignKeyName: "result_station_id_fkey";
            columns: ["station_id"];
            isOneToOne: false;
            referencedRelation: "polling_station";
            referencedColumns: ["station_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      cast_vote: {
        Args: AsRecord<CastVoteArgs>;
        Returns: unknown;
      };
    };
    Enums: {
      election_status: ElectionStatus;
      approval_status: ApprovalStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export type PublicTableName = keyof Database["public"]["Tables"];
export type TableRow<T extends PublicTableName> =
  Database["public"]["Tables"][T]["Row"];
export type TableInsert<T extends PublicTableName> =
  Database["public"]["Tables"][T]["Insert"];
export type TableUpdate<T extends PublicTableName> =
  Database["public"]["Tables"][T]["Update"];
