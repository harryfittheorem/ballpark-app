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
    PostgrestVersion: "14.5"
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
      bookings: {
        Row: {
          attended_at: string | null
          cage_number: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          coach_id: string
          created_at: string
          id: string
          kid_id: string
          location_id: string
          notes: string | null
          scheduled_end: string
          scheduled_start: string
          session_type_id: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          attended_at?: string | null
          cage_number?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          coach_id: string
          created_at?: string
          id?: string
          kid_id: string
          location_id: string
          notes?: string | null
          scheduled_end: string
          scheduled_start: string
          session_type_id: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          attended_at?: string | null
          cage_number?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          coach_id?: string
          created_at?: string
          id?: string
          kid_id?: string
          location_id?: string
          notes?: string | null
          scheduled_end?: string
          scheduled_start?: string
          session_type_id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_kid_id_fkey"
            columns: ["kid_id"]
            isOneToOne: false
            referencedRelation: "kids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_session_type_id_fkey"
            columns: ["session_type_id"]
            isOneToOne: false
            referencedRelation: "session_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_availability: {
        Row: {
          coach_id: string
          created_at: string
          day_of_week: number
          effective_from: string | null
          effective_until: string | null
          end_time: string
          id: string
          is_recurring: boolean
          location_id: string
          start_time: string
          tenant_id: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          day_of_week: number
          effective_from?: string | null
          effective_until?: string | null
          end_time: string
          id?: string
          is_recurring?: boolean
          location_id: string
          start_time: string
          tenant_id: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          day_of_week?: number
          effective_from?: string | null
          effective_until?: string | null
          end_time?: string
          id?: string
          is_recurring?: boolean
          location_id?: string
          start_time?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_availability_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_availability_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_availability_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_messages: {
        Row: {
          created_at: string
          id: string
          message_text: string | null
          recipient_family_id: string
          recipient_kid_id: string
          sender_user_id: string
          tenant_id: string
          updated_at: string
          video_id: string | null
          viewed_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message_text?: string | null
          recipient_family_id: string
          recipient_kid_id: string
          sender_user_id: string
          tenant_id: string
          updated_at?: string
          video_id?: string | null
          viewed_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message_text?: string | null
          recipient_family_id?: string
          recipient_kid_id?: string
          sender_user_id?: string
          tenant_id?: string
          updated_at?: string
          video_id?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_messages_recipient_family_id_fkey"
            columns: ["recipient_family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_messages_recipient_kid_id_fkey"
            columns: ["recipient_kid_id"]
            isOneToOne: false
            referencedRelation: "kids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_messages_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      coaches: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          first_name: string
          id: string
          is_active: boolean
          last_name: string
          primary_location_id: string | null
          specialty: string | null
          tenant_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          first_name: string
          id?: string
          is_active?: boolean
          last_name: string
          primary_location_id?: string | null
          specialty?: string | null
          tenant_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          primary_location_id?: string | null
          specialty?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coaches_primary_location_id_fkey"
            columns: ["primary_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string
          id: string
          parent_email: string
          parent_first_name: string
          parent_last_name: string
          parent_phone: string | null
          parent_user_id: string
          primary_location_id: string | null
          role: string
          stripe_customer_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          parent_email: string
          parent_first_name: string
          parent_last_name: string
          parent_phone?: string | null
          parent_user_id: string
          primary_location_id?: string | null
          role?: string
          stripe_customer_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          parent_email?: string
          parent_first_name?: string
          parent_last_name?: string
          parent_phone?: string | null
          parent_user_id?: string
          primary_location_id?: string | null
          role?: string
          stripe_customer_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "families_primary_location_id_fkey"
            columns: ["primary_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "families_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      kids: {
        Row: {
          age_group: string | null
          avatar_url: string | null
          created_at: string
          current_streak_days: number
          date_of_birth: string | null
          family_id: string
          first_name: string
          id: string
          jersey_number: number | null
          last_name: string
          points_balance: number
          primary_position: string | null
          updated_at: string
        }
        Insert: {
          age_group?: string | null
          avatar_url?: string | null
          created_at?: string
          current_streak_days?: number
          date_of_birth?: string | null
          family_id: string
          first_name: string
          id?: string
          jersey_number?: number | null
          last_name: string
          points_balance?: number
          primary_position?: string | null
          updated_at?: string
        }
        Update: {
          age_group?: string | null
          avatar_url?: string | null
          created_at?: string
          current_streak_days?: number
          date_of_birth?: string | null
          family_id?: string
          first_name?: string
          id?: string
          jersey_number?: number | null
          last_name?: string
          points_balance?: number
          primary_position?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          state: string | null
          stripe_account_id: string | null
          tenant_id: string
          timezone: string
          updated_at: string
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          state?: string | null
          stripe_account_id?: string | null
          tenant_id: string
          timezone?: string
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          state?: string | null
          stripe_account_id?: string | null
          tenant_id?: string
          timezone?: string
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      session_types: {
        Row: {
          base_price_cents: number
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          type_category: string
          updated_at: string
        }
        Insert: {
          base_price_cents?: number
          created_at?: string
          description?: string | null
          duration_minutes: number
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
          type_category: string
          updated_at?: string
        }
        Update: {
          base_price_cents?: number
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          type_category?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          brand_colors: Json
          brand_logo_url: string | null
          created_at: string
          id: string
          name: string
          slug: string
          stripe_account_id: string | null
          updated_at: string
        }
        Insert: {
          brand_colors?: Json
          brand_logo_url?: string | null
          created_at?: string
          id?: string
          name: string
          slug: string
          stripe_account_id?: string | null
          updated_at?: string
        }
        Update: {
          brand_colors?: Json
          brand_logo_url?: string | null
          created_at?: string
          id?: string
          name?: string
          slug?: string
          stripe_account_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      videos: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          mux_asset_id: string
          mux_playback_id: string | null
          status: string
          tenant_id: string
          title: string | null
          updated_at: string
          uploaded_by_user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          mux_asset_id: string
          mux_playback_id?: string | null
          status?: string
          tenant_id: string
          title?: string | null
          updated_at?: string
          uploaded_by_user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          mux_asset_id?: string
          mux_playback_id?: string | null
          status?: string
          tenant_id?: string
          title?: string | null
          updated_at?: string
          uploaded_by_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "videos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      mark_coach_message_viewed: {
        Args: { p_message_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
    Enums: {},
  },
} as const
