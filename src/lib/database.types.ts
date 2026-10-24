export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_types: {
        Row: {
          default_duration_min: number | null
          id: string
          name: string
          pillar: Database["public"]["Enums"]["per_pillar"]
          requires_rpe: boolean
        }
        Insert: {
          default_duration_min?: number | null
          id?: string
          name: string
          pillar: Database["public"]["Enums"]["per_pillar"]
          requires_rpe?: boolean
        }
        Update: {
          default_duration_min?: number | null
          id?: string
          name?: string
          pillar?: Database["public"]["Enums"]["per_pillar"]
          requires_rpe?: boolean
        }
        Relationships: []
      }
      body_measurements: {
        Row: {
          height_cm: number | null
          id: string
          measured_on: string
          player_id: string
          weight_kg: number | null
        }
        Insert: {
          height_cm?: number | null
          id?: string
          measured_on: string
          player_id: string
          weight_kg?: number | null
        }
        Update: {
          height_cm?: number | null
          id?: string
          measured_on?: string
          player_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "body_measurements_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cycles: {
        Row: {
          first_week: string | null
          focus: string | null
          group_id: string
          id: string
          last_week: string | null
          name: string
          objective: string | null
        }
        Insert: {
          first_week?: string | null
          focus?: string | null
          group_id: string
          id?: string
          last_week?: string | null
          name: string
          objective?: string | null
        }
        Update: {
          first_week?: string | null
          focus?: string | null
          group_id?: string
          id?: string
          last_week?: string | null
          name?: string
          objective?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cycles_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_feedback: {
        Row: {
          comment: string | null
          created_at: string
          done_load: string | null
          id: string
          planned_exercise_id: string
          player_id: string
          rpe: number | null
          status: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          done_load?: string | null
          id?: string
          planned_exercise_id: string
          player_id: string
          rpe?: number | null
          status?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          done_load?: string | null
          id?: string
          planned_exercise_id?: string
          player_id?: string
          rpe?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_feedback_planned_exercise_id_fkey"
            columns: ["planned_exercise_id"]
            isOneToOne: false
            referencedRelation: "planned_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_feedback_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          abbreviation: string | null
          category: string | null
          id: string
          name: string
          notes: string | null
          video_url: string | null
        }
        Insert: {
          abbreviation?: string | null
          category?: string | null
          id?: string
          name: string
          notes?: string | null
          video_url?: string | null
        }
        Update: {
          abbreviation?: string | null
          category?: string | null
          id?: string
          name?: string
          notes?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      group_members: {
        Row: {
          group_id: string
          player_id: string
        }
        Insert: {
          group_id: string
          player_id: string
        }
        Update: {
          group_id?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          id: string
          name: string
          season: string
        }
        Insert: {
          id?: string
          name: string
          season: string
        }
        Update: {
          id?: string
          name?: string
          season?: string
        }
        Relationships: []
      }
      planned_exercises: {
        Row: {
          block_label: string | null
          exercise_id: string
          id: string
          instructions: string | null
          load_unit: string | null
          load_value: number | null
          planned_session_id: string
          position: number
          reps: string | null
          rest: string | null
          sets: number | null
          target_velocity: number | null
          tempo: string | null
        }
        Insert: {
          block_label?: string | null
          exercise_id: string
          id?: string
          instructions?: string | null
          load_unit?: string | null
          load_value?: number | null
          planned_session_id: string
          position: number
          reps?: string | null
          rest?: string | null
          sets?: number | null
          target_velocity?: number | null
          tempo?: string | null
        }
        Update: {
          block_label?: string | null
          exercise_id?: string
          id?: string
          instructions?: string | null
          load_unit?: string | null
          load_value?: number | null
          planned_session_id?: string
          position?: number
          reps?: string | null
          rest?: string | null
          sets?: number | null
          target_velocity?: number | null
          tempo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "planned_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_exercises_planned_session_id_fkey"
            columns: ["planned_session_id"]
            isOneToOne: false
            referencedRelation: "planned_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      planned_sessions: {
        Row: {
          activity_type_id: string | null
          created_at: string
          created_by: string | null
          focus: string | null
          group_id: string | null
          id: string
          planned_duration_min: number | null
          planned_rpe: number | null
          player_id: string | null
          session_date: string
          title: string
        }
        Insert: {
          activity_type_id?: string | null
          created_at?: string
          created_by?: string | null
          focus?: string | null
          group_id?: string | null
          id?: string
          planned_duration_min?: number | null
          planned_rpe?: number | null
          player_id?: string | null
          session_date: string
          title: string
        }
        Update: {
          activity_type_id?: string | null
          created_at?: string
          created_by?: string | null
          focus?: string | null
          group_id?: string | null
          id?: string
          planned_duration_min?: number | null
          planned_rpe?: number | null
          player_id?: string | null
          session_date?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "planned_sessions_activity_type_id_fkey"
            columns: ["activity_type_id"]
            isOneToOne: false
            referencedRelation: "activity_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_sessions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_availability: {
        Row: {
          note: string | null
          player_id: string
          since: string
          status: Database["public"]["Enums"]["availability_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          note?: string | null
          player_id: string
          since?: string
          status: Database["public"]["Enums"]["availability_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          note?: string | null
          player_id?: string
          since?: string
          status?: Database["public"]["Enums"]["availability_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_availability_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_availability_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_cycle_reviews: {
        Row: {
          coach_directives: string | null
          cycle_id: string
          id: string
          key_session: string | null
          mobility_review: string | null
          player_id: string
          status: string | null
          strength_progression: string | null
        }
        Insert: {
          coach_directives?: string | null
          cycle_id: string
          id?: string
          key_session?: string | null
          mobility_review?: string | null
          player_id: string
          status?: string | null
          strength_progression?: string | null
        }
        Update: {
          coach_directives?: string | null
          cycle_id?: string
          id?: string
          key_session?: string | null
          mobility_review?: string | null
          player_id?: string
          status?: string | null
          strength_progression?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_cycle_reviews_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_cycle_reviews_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_season_profiles: {
        Row: {
          health_objective: string | null
          id: string
          main_objective: string | null
          player_id: string
          power_to_develop: string | null
          profile_type: string | null
          season: string
          weekly_template: string | null
        }
        Insert: {
          health_objective?: string | null
          id?: string
          main_objective?: string | null
          player_id: string
          power_to_develop?: string | null
          profile_type?: string | null
          season: string
          weekly_template?: string | null
        }
        Update: {
          health_objective?: string | null
          id?: string
          main_objective?: string | null
          player_id?: string
          power_to_develop?: string | null
          profile_type?: string | null
          season?: string
          weekly_template?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_season_profiles_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_targets: {
        Row: {
          id: string
          label: string | null
          player_id: string
          season: string
          target_value: number
          test_id: string
        }
        Insert: {
          id?: string
          label?: string | null
          player_id: string
          season: string
          target_value: number
          test_id: string
        }
        Update: {
          id?: string
          label?: string | null
          player_id?: string
          season?: string
          target_value?: number
          test_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_targets_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_targets_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "test_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          birth_date: string | null
          created_at: string
          first_name: string
          id: string
          import_name: string | null
          is_active: boolean
          last_name: string
          position: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          first_name: string
          id: string
          import_name?: string | null
          is_active?: boolean
          last_name: string
          position?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          first_name?: string
          id?: string
          import_name?: string | null
          is_active?: boolean
          last_name?: string
          position?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      season_weeks: {
        Row: {
          code: string
          cycle: string | null
          group_id: string
          id: string
          label: string | null
          phase_note: string | null
          start_date: string
          week_type_code: string
        }
        Insert: {
          code: string
          cycle?: string | null
          group_id: string
          id?: string
          label?: string | null
          phase_note?: string | null
          start_date: string
          week_type_code: string
        }
        Update: {
          code?: string
          cycle?: string | null
          group_id?: string
          id?: string
          label?: string | null
          phase_note?: string | null
          start_date?: string
          week_type_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_weeks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_weeks_week_type_code_fkey"
            columns: ["week_type_code"]
            isOneToOne: false
            referencedRelation: "week_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "season_weeks_week_type_code_fkey"
            columns: ["week_type_code"]
            isOneToOne: false
            referencedRelation: "weekly_group_load"
            referencedColumns: ["week_type"]
          },
          {
            foreignKeyName: "season_weeks_week_type_code_fkey"
            columns: ["week_type_code"]
            isOneToOne: false
            referencedRelation: "weekly_player_load"
            referencedColumns: ["week_type"]
          },
        ]
      }
      session_logs: {
        Row: {
          activity_type_id: string | null
          comment: string | null
          created_at: string
          duration_min: number
          id: string
          planned_session_id: string | null
          player_id: string
          rpe: number | null
          session_date: string
          session_type: string | null
          source: string
          srpe: number | null
          validated_at: string | null
        }
        Insert: {
          activity_type_id?: string | null
          comment?: string | null
          created_at?: string
          duration_min: number
          id?: string
          planned_session_id?: string | null
          player_id: string
          rpe?: number | null
          session_date?: string
          session_type?: string | null
          source?: string
          srpe?: number | null
          validated_at?: string | null
        }
        Update: {
          activity_type_id?: string | null
          comment?: string | null
          created_at?: string
          duration_min?: number
          id?: string
          planned_session_id?: string | null
          player_id?: string
          rpe?: number | null
          session_date?: string
          session_type?: string | null
          source?: string
          srpe?: number | null
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_logs_activity_type_id_fkey"
            columns: ["activity_type_id"]
            isOneToOne: false
            referencedRelation: "activity_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_logs_planned_session_id_fkey"
            columns: ["planned_session_id"]
            isOneToOne: false
            referencedRelation: "planned_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_logs_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      test_definitions: {
        Row: {
          category: string | null
          higher_is_better: boolean
          id: string
          name: string
          unit: string
        }
        Insert: {
          category?: string | null
          higher_is_better?: boolean
          id?: string
          name: string
          unit: string
        }
        Update: {
          category?: string | null
          higher_is_better?: boolean
          id?: string
          name?: string
          unit?: string
        }
        Relationships: []
      }
      test_results: {
        Row: {
          id: string
          notes: string | null
          period: string | null
          player_id: string
          test_date: string
          test_id: string
          value: number
        }
        Insert: {
          id?: string
          notes?: string | null
          period?: string | null
          player_id: string
          test_date: string
          test_id: string
          value: number
        }
        Update: {
          id?: string
          notes?: string | null
          period?: string | null
          player_id?: string
          test_date?: string
          test_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "test_results_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_results_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "test_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      week_types: {
        Row: {
          accompagnement_min: number
          code: string
          guidance: string | null
          name: string
          physique_min: number
          ppid_min: number
          rugby_min: number
          srpe_max: number | null
          srpe_min: number | null
          target_srpe: number
          volume_min: number
        }
        Insert: {
          accompagnement_min: number
          code: string
          guidance?: string | null
          name: string
          physique_min: number
          ppid_min: number
          rugby_min: number
          srpe_max?: number | null
          srpe_min?: number | null
          target_srpe: number
          volume_min: number
        }
        Update: {
          accompagnement_min?: number
          code?: string
          guidance?: string | null
          name?: string
          physique_min?: number
          ppid_min?: number
          rugby_min?: number
          srpe_max?: number | null
          srpe_min?: number | null
          target_srpe?: number
          volume_min?: number
        }
        Relationships: []
      }
      wellness_entries: {
        Row: {
          comment: string | null
          created_at: string
          entry_date: string
          fatigue: number
          id: string
          mood: number
          player_id: string
          score: number | null
          sleep_hours: number | null
          sleep_quality: number
          soreness: number | null
          soreness_lower: number | null
          soreness_upper: number | null
          stress: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          entry_date?: string
          fatigue: number
          id?: string
          mood: number
          player_id: string
          score?: number | null
          sleep_hours?: number | null
          sleep_quality: number
          soreness?: number | null
          soreness_lower?: number | null
          soreness_upper?: number | null
          stress: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          entry_date?: string
          fatigue?: number
          id?: string
          mood?: number
          player_id?: string
          score?: number | null
          sleep_hours?: number | null
          sleep_quality?: number
          soreness?: number | null
          soreness_lower?: number | null
          soreness_upper?: number | null
          stress?: number
        }
        Relationships: [
          {
            foreignKeyName: "wellness_entries_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      session_completion: {
        Row: {
          avg_rpe: number | null
          completion_pct: number | null
          done: number | null
          exercises: number | null
          planned_session_id: string | null
          player_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_feedback_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_exercises_planned_session_id_fkey"
            columns: ["planned_session_id"]
            isOneToOne: false
            referencedRelation: "planned_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_group_load: {
        Row: {
          avg_min: number | null
          avg_srpe: number | null
          group_id: string | null
          over_count: number | null
          players: number | null
          target_srpe: number | null
          under_count: number | null
          week_code: string | null
          week_start: string | null
          week_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_player_load: {
        Row: {
          accompagnement_min: number | null
          activities: number | null
          avg_rpe: number | null
          cycle: string | null
          group_id: string | null
          pct_target: number | null
          physique_min: number | null
          player_id: string | null
          ppid_min: number | null
          rugby_min: number | null
          srpe: number | null
          status: string | null
          target_srpe: number | null
          total_min: number | null
          week_code: string | null
          week_start: string | null
          week_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_logs_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_edit_feedback: {
        Args: { p_planned_exercise_id: string }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      paris_today: { Args: never; Returns: string }
    }
    Enums: {
      availability_status: "apte" | "blessé"
      per_pillar: "rugby" | "physique" | "accompagnement" | "ppid"
      user_role: "player" | "coach" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      availability_status: ["apte", "blessé"],
      per_pillar: ["rugby", "physique", "accompagnement", "ppid"],
      user_role: ["player", "coach", "admin"],
    },
  },
} as const
