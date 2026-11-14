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
          mobility_loans_per_day: number;
          updated_at: Timestamp;
        };
        Insert: {
          id: string;
          name: string;
          has_counter?: boolean;
          sort_order?: number;
          substitution_rank?: number;
        };
        Update: { substitution_rank?: number; mobility_loans_per_day?: number };
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
          mail_enabled: boolean;
          charge_cancellation_from: string;
          day_close_reminder_at: string | null;
          signal_incident_factor: number | null;
          signal_incident_min: number;
          signal_unclosed_days: number | null;
          signal_charge_days: number | null;
          signal_short_days: number | null;
          signal_unused_percent: number | null;
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
          mail_enabled?: boolean;
          charge_cancellation_from?: string;
          day_close_reminder_at?: string | null;
          signal_incident_factor?: number | null;
          signal_incident_min?: number;
          signal_unclosed_days?: number | null;
          signal_charge_days?: number | null;
          signal_short_days?: number | null;
          signal_unused_percent?: number | null;
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
          is_team_lead: boolean;
          is_active: boolean;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          name: string;
          group_id: string;
          default_role?: string;
          is_admin?: boolean;
          is_team_lead?: boolean;
          is_active?: boolean;
        };
        Update: {
          name?: string;
          group_id?: string;
          default_role?: string;
          is_admin?: boolean;
          is_team_lead?: boolean;
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
        Relationships: [
          {
            foreignKeyName: 'employee_accounts_employee_id_fkey';
            columns: ['employee_id'];
            isOneToOne: true;
            referencedRelation: 'employees';
            referencedColumns: ['id'];
          },
        ];
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
      substitutions: {
        Row: {
          id: string;
          employee_id: string;
          date: string;
          group_id: string;
          day_part: string;
          status: string;
          handled_at: Timestamp | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: { employee_id: string; date: string; group_id: string; day_part?: string };
        Update: { day_part?: string; status?: string; handled_at?: Timestamp | null };
        Relationships: [];
      };
      shift_overrides: {
        Row: {
          id: string;
          employee_id: string;
          date: string;
          kind: string;
          group_id: string | null;
          role: string | null;
          start_time: string | null;
          end_time: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          employee_id: string;
          date: string;
          kind: string;
          group_id?: string | null;
          role?: string | null;
          start_time?: string | null;
          end_time?: string | null;
        };
        Update: {
          kind?: string;
          group_id?: string | null;
          role?: string | null;
          start_time?: string | null;
          end_time?: string | null;
        };
        Relationships: [];
      };
      mail_queue: {
        Row: {
          id: string;
          employee_id: string;
          kind: string;
          dates: string[];
          status: string;
          attempts: number;
          last_error: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
          sent_at: Timestamp | null;
          push_devices: number;
        };
        Insert: { employee_id: string; kind: string; dates: string[]; status?: string; last_error?: string | null };
        Update: {
          status?: string;
          attempts?: number;
          last_error?: string | null;
          sent_at?: Timestamp | null;
          push_devices?: number;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          employee_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at: Timestamp;
          last_success_at: Timestamp | null;
        };
        // Aanmelden gaat via register_push_subscription; direct invoegen mag niemand behalve de server.
        Insert: { employee_id: string; endpoint: string; p256dh: string; auth: string };
        Update: { last_success_at?: Timestamp | null };
        Relationships: [];
      };
      gap_dismissals: {
        Row: {
          id: string;
          group_id: string;
          date: string;
          day_part: string;
          shortage: number;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: { group_id: string; date: string; day_part: string; shortage: number };
        Update: { shortage?: number };
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
      vehicle_loans: {
        Row: {
          id: string;
          group_id: string;
          has_counter: boolean;
          license_plate: string;
          model: string;
          destination: string;
          handed_to: string;
          handed_out_by: string | null;
          handed_out_at: Timestamp;
          odometer_out: number | null;
          returned_at: Timestamp | null;
          returned_by: string | null;
          odometer_in: number | null;
          was_used: boolean | null;
          note: string | null;
          return_note: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          group_id: string;
          license_plate: string;
          model: string;
          destination: string;
          handed_to: string;
          handed_out_at?: Timestamp;
          odometer_out?: number | null;
          note?: string | null;
        };
        Update: {
          group_id?: string;
          license_plate?: string;
          model?: string;
          destination?: string;
          handed_to?: string;
          handed_out_at?: Timestamp;
          odometer_out?: number | null;
          note?: string | null;
          returned_at?: Timestamp | null;
          odometer_in?: number | null;
          was_used?: boolean | null;
          return_note?: string | null;
        };
        Relationships: [];
      };
      workshops: {
        Row: {
          id: string;
          group_id: string;
          has_counter: boolean;
          name: string;
          sort_order: number;
          is_active: boolean;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: { group_id: string; name: string; sort_order?: number; is_active?: boolean };
        Update: { name?: string; sort_order?: number; is_active?: boolean };
        Relationships: [];
      };
      walk_ins: {
        Row: {
          id: string;
          group_id: string;
          workshop_id: string;
          date: string;
          count: number;
          updated_by: string | null;
          updated_at: Timestamp;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      incident_reports: {
        Row: {
          id: string;
          group_id: string;
          workshop_id: string;
          occurred_at: Timestamp;
          kind: string;
          missing: string | null;
          cancelled_at: string | null;
          charge: boolean | null;
          charged_at: Timestamp | null;
          charged_by: string | null;
          license_plate: string | null;
          contract_number: string | null;
          note: string | null;
          reported_by: string | null;
          import_key: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          group_id: string;
          workshop_id: string;
          occurred_at?: Timestamp;
          kind: string;
          missing?: string | null;
          cancelled_at?: string | null;
          charge?: boolean | null;
          license_plate?: string | null;
          contract_number?: string | null;
          note?: string | null;
        };
        Update: {
          group_id?: string;
          workshop_id?: string;
          occurred_at?: Timestamp;
          kind?: string;
          missing?: string | null;
          cancelled_at?: string | null;
          charge?: boolean | null;
          license_plate?: string | null;
          contract_number?: string | null;
          note?: string | null;
        };
        Relationships: [];
      };
      day_closures: {
        Row: {
          id: string;
          group_id: string;
          has_counter: boolean;
          date: string;
          rentlink_checked: boolean;
          closed_by: string | null;
          closed_at: Timestamp;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      day_close_reminders: {
        Row: { group_id: string; has_counter: boolean; date: string; devices: number; sent_at: Timestamp };
        Insert: { group_id: string; date: string; devices?: number };
        Update: { devices?: number };
        Relationships: [];
      };
      monthly_incident_totals: {
        Row: { month: string; group_id: string; workshop_id: string; kind: string; total: number; chargeable: number; charged: number; refreshed_at: Timestamp };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      monthly_loan_totals: {
        Row: { month: string; group_id: string; destination: string; total: number; used: number; unused: number; refreshed_at: Timestamp };
        Insert: Record<string, never>;
        Update: Record<string, never>;
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
      set_shift_override: {
        Args: {
          p_employee_id: string;
          p_date: string;
          p_kind: string;
          p_group_id: string | null;
          p_role: string | null;
          p_start_time: string | null;
          p_end_time: string | null;
        };
        Returns: string;
      };
      move_shift: {
        Args: {
          p_employee_id: string;
          p_from: string;
          p_to: string;
          p_group_id: string;
          p_role: string;
          p_start_time: string | null;
          p_end_time: string | null;
        };
        Returns: string;
      };
      apply_substitution_review: { Args: { changes: Json }; Returns: number };
      delete_employee: { Args: { p_employee_id: string }; Returns: Json };
      employee_sign_ins: { Args: { p_employee_id?: string }; Returns: Json };
      adjust_walk_in: { Args: { p_workshop_id: string; p_date: string; p_delta: number }; Returns: number };
      close_day: { Args: { p_group_id: string; p_date: string; p_rentlink_checked: boolean }; Returns: boolean };
      reopen_day: { Args: { p_group_id: string; p_date: string }; Returns: number };
      set_incident_charged: { Args: { p_id: string; p_charged: boolean }; Returns: number };
      import_registrations: { Args: { plan: Json }; Returns: Json };
      refresh_monthly_totals: { Args: Record<string, never>; Returns: number };
      report_walk_ins: {
        Args: { p_unit: string; p_from: string; p_to: string };
        Returns: { bucket: string; group_id: string; workshop_id: string; total: number }[];
      };
      report_incidents: {
        Args: { p_unit: string; p_from: string; p_to: string };
        Returns: { bucket: string; group_id: string; workshop_id: string; kind: string; total: number; chargeable: number; charged: number }[];
      };
      log_export: { Args: { p_kind: string; p_employee_id: string | null }; Returns: undefined };
      register_push_subscription: { Args: { p_endpoint: string; p_p256dh: string; p_auth: string }; Returns: undefined };
      return_vehicle_loan: {
        Args: {
          p_id: string;
          p_was_used: boolean;
          p_odometer_in?: number | null;
          p_note?: string | null;
          p_returned_at?: string | null;
        };
        Returns: number;
      };
      undo_vehicle_loan_return: { Args: { p_id: string }; Returns: number };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
