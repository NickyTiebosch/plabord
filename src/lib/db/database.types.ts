/**
 * Types van het databaseschema (supabase/migrations). Met de hand bijgehouden:
 * pas dit aan bij elke migratie.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamp = string;

export interface Database {
  public: {
    Tables: {
      groups: {
        Row: {
          id: string;
          name: string;
          has_counter: boolean;
          sort_order: number;
          substitution_rank: number;
          updated_at: Timestamp;
        };
        Insert: {
          id: string;
          name: string;
          has_counter?: boolean;
          sort_order?: number;
          substitution_rank?: number;
        };
        Update: { substitution_rank?: number };
        Relationships: [];
      };
      settings: {
        Row: {
          id: boolean;
          standard_shift_start: string;
          standard_shift_end: string;
          saturday_shift_start: string;
          saturday_shift_end: string;
          day_part_boundary: string;
          lookahead_weeks: number;
          updated_at: Timestamp;
        };
        Insert: { id?: boolean };
        Update: {
          standard_shift_start?: string;
          standard_shift_end?: string;
          saturday_shift_start?: string;
          saturday_shift_end?: string;
          day_part_boundary?: string;
          lookahead_weeks?: number;
        };
        Relationships: [];
      };
      staffing_norms: {
        Row: {
          group_id: string;
          has_counter: boolean;
          weekday: number;
          day_part: string;
          min_staff: number;
          updated_at: Timestamp;
        };
        Insert: { group_id: string; weekday: number; day_part: string; min_staff?: number };
        Update: { min_staff?: number };
        Relationships: [];
      };
      employees: {
        Row: {
          id: string;
          name: string;
          group_id: string;
          default_role: string;
          is_admin: boolean;
          is_active: boolean;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          name: string;
          group_id: string;
          default_role?: string;
          is_admin?: boolean;
          is_active?: boolean;
        };
        Update: {
          name?: string;
          group_id?: string;
          default_role?: string;
          is_admin?: boolean;
          is_active?: boolean;
        };
        Relationships: [];
      };
      employee_accounts: {
        Row: {
          employee_id: string;
          email: string;
          user_id: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: { employee_id: string; email: string; user_id?: string | null };
        Update: { email?: string; user_id?: string | null };
        Relationships: [];
      };
      counter_eligibility: {
        Row: { employee_id: string; group_id: string; has_counter: boolean; created_at: Timestamp };
        Insert: { employee_id: string; group_id: string };
        Update: Record<string, never>;
        Relationships: [];
      };
      recurring_shifts: {
        Row: {
          id: string;
          employee_id: string;
          weekday: number;
          group_id: string;
          role: string;
          start_time: string | null;
          end_time: string | null;
          valid_from: string;
          valid_to: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          employee_id: string;
          weekday: number;
          group_id: string;
          role: string;
          start_time?: string | null;
          end_time?: string | null;
          valid_from: string;
          valid_to?: string | null;
        };
        Update: {
          group_id?: string;
          role?: string;
          start_time?: string | null;
          end_time?: string | null;
          valid_from?: string;
          valid_to?: string | null;
        };
        Relationships: [];
      };
      absences: {
        Row: {
          id: string;
          employee_id: string;
          start_date: string;
          end_date: string;
          day_part: string;
          status: string;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          employee_id: string;
          start_date: string;
          end_date: string;
          day_part?: string;
          status?: string;
        };
        Update: {
          employee_id?: string;
          start_date?: string;
          end_date?: string;
          day_part?: string;
          status?: string;
        };
        Relationships: [];
      };
      closure_days: {
        Row: {
          id: string;
          date: string;
          group_id: string | null;
          is_closed: boolean;
          label: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: { date: string; group_id?: string | null; is_closed: boolean; label?: string | null };
        Update: { is_closed?: boolean; label?: string | null };
        Relationships: [];
      };
      calendar_feeds: {
        Row: {
          id: string;
          employee_id: string;
          kind: string;
          group_id: string | null;
          token_hash: string;
          created_at: Timestamp;
          revoked_at: Timestamp | null;
        };
        Insert: { employee_id: string; kind: string; group_id?: string | null; token_hash: string };
        Update: { revoked_at?: Timestamp | null };
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: number;
          occurred_at: Timestamp;
          actor_user_id: string | null;
          actor_employee_id: string | null;
          action: string;
          entity: string;
          entity_id: string | null;
          employee_id: string | null;
          changed_fields: string[] | null;
          details: Json | null;
          source: string | null;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      claim_account: { Args: Record<string, never>; Returns: string | null };
      apply_import: { Args: { plan: Json }; Returns: Json };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
