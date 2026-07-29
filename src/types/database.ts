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
      achievements: {
        Row: {
          created_at: string
          description: string
          icon: string
          id: string
          key: string
          name: string
          points_bonus: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          description: string
          icon: string
          id?: string
          key: string
          name: string
          points_bonus?: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          key?: string
          name?: string
          points_bonus?: number
          sort_order?: number
        }
        Relationships: []
      }
      assignments: {
        Row: {
          coach_user_id: string
          created_at: string
          description: string | null
          drill_video_id: string | null
          due_date: string | null
          duration_estimate_minutes: number | null
          family_id: string
          feedback: string | null
          id: string
          kid_id: string
          point_reward: number
          rating: number | null
          reviewed_at: string | null
          status: string
          submitted_at: string | null
          submitted_video_url: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          coach_user_id: string
          created_at?: string
          description?: string | null
          drill_video_id?: string | null
          due_date?: string | null
          duration_estimate_minutes?: number | null
          family_id: string
          feedback?: string | null
          id?: string
          kid_id: string
          point_reward?: number
          rating?: number | null
          reviewed_at?: string | null
          status?: string
          submitted_at?: string | null
          submitted_video_url?: string | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          coach_user_id?: string
          created_at?: string
          description?: string | null
          drill_video_id?: string | null
          due_date?: string | null
          duration_estimate_minutes?: number | null
          family_id?: string
          feedback?: string | null
          id?: string
          kid_id?: string
          point_reward?: number
          rating?: number | null
          reviewed_at?: string | null
          status?: string
          submitted_at?: string | null
          submitted_video_url?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_drill_video_id_fkey"
            columns: ["drill_video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_kid_id_fkey"
            columns: ["kid_id"]
            isOneToOne: false
            referencedRelation: "kids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_reminder_log: {
        Row: {
          booking_id: string
          created_at: string
          id: string
          reminder_type: string
          sent_at: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          id?: string
          reminder_type: string
          sent_at?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          id?: string
          reminder_type?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_reminder_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_waitlist: {
        Row: {
          claim_deadline: string | null
          coach_id: string
          created_at: string
          family_id: string
          id: string
          kid_id: string
          location_id: string
          notified_at: string | null
          position: number
          scheduled_end: string
          scheduled_start: string
          session_slot_key: string
          session_type_id: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          claim_deadline?: string | null
          coach_id: string
          created_at?: string
          family_id: string
          id?: string
          kid_id: string
          location_id: string
          notified_at?: string | null
          position: number
          scheduled_end: string
          scheduled_start: string
          session_slot_key: string
          session_type_id: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          claim_deadline?: string | null
          coach_id?: string
          created_at?: string
          family_id?: string
          id?: string
          kid_id?: string
          location_id?: string
          notified_at?: string | null
          position?: number
          scheduled_end?: string
          scheduled_start?: string
          session_slot_key?: string
          session_type_id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_waitlist_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_waitlist_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_waitlist_kid_id_fkey"
            columns: ["kid_id"]
            isOneToOne: false
            referencedRelation: "kids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_waitlist_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_waitlist_session_type_id_fkey"
            columns: ["session_type_id"]
            isOneToOne: false
            referencedRelation: "session_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_waitlist_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          attended_at: string | null
          cage_number: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          coach_id: string
          created_at: string
          guest_email: string | null
          guest_name: string | null
          guest_phone: string | null
          id: string
          is_guest: boolean
          kid_id: string
          location_id: string
          notes: string | null
          scheduled_end: string
          scheduled_start: string
          session_credit_restored: boolean
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
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          is_guest?: boolean
          kid_id: string
          location_id: string
          notes?: string | null
          scheduled_end: string
          scheduled_start: string
          session_credit_restored?: boolean
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
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          is_guest?: boolean
          kid_id?: string
          location_id?: string
          notes?: string | null
          scheduled_end?: string
          scheduled_start?: string
          session_credit_restored?: boolean
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
      coach_locations: {
        Row: {
          coach_id: string
          created_at: string
          id: string
          is_primary: boolean
          location_id: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          location_id: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          location_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_locations_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_messages: {
        Row: {
          created_at: string
          id: string
          label: string | null
          message_text: string | null
          recipient_coach_user_id: string | null
          recipient_family_id: string
          recipient_kid_id: string
          sender_display: string | null
          sender_user_id: string
          tenant_id: string
          updated_at: string
          video_id: string | null
          viewed_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          message_text?: string | null
          recipient_coach_user_id?: string | null
          recipient_family_id: string
          recipient_kid_id: string
          sender_display?: string | null
          sender_user_id: string
          tenant_id: string
          updated_at?: string
          video_id?: string | null
          viewed_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          message_text?: string | null
          recipient_coach_user_id?: string | null
          recipient_family_id?: string
          recipient_kid_id?: string
          sender_display?: string | null
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
          capabilities: Json
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
          capabilities?: Json
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
          capabilities?: Json
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
      device_tokens: {
        Row: {
          created_at: string
          expo_push_token: string
          id: string
          last_seen_at: string
          platform: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expo_push_token: string
          id?: string
          last_seen_at?: string
          platform: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expo_push_token?: string
          id?: string
          last_seen_at?: string
          platform?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          card_brand: string | null
          card_exp_month: number | null
          card_exp_year: number | null
          card_last4: string | null
          created_at: string
          id: string
          parent_email: string
          parent_first_name: string
          parent_last_name: string
          parent_phone: string | null
          parent_user_id: string
          primary_location_id: string | null
          role: string
          stripe_connected_customer_id: string | null
          stripe_customer_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          card_brand?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          card_last4?: string | null
          created_at?: string
          id?: string
          parent_email: string
          parent_first_name: string
          parent_last_name: string
          parent_phone?: string | null
          parent_user_id: string
          primary_location_id?: string | null
          role?: string
          stripe_connected_customer_id?: string | null
          stripe_customer_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          card_brand?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          card_last4?: string | null
          created_at?: string
          id?: string
          parent_email?: string
          parent_first_name?: string
          parent_last_name?: string
          parent_phone?: string | null
          parent_user_id?: string
          primary_location_id?: string | null
          role?: string
          stripe_connected_customer_id?: string | null
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
      family_waivers: {
        Row: {
          app_version: string | null
          family_id: string
          id: string
          ip_address: string | null
          signature_image_path: string | null
          signed_at: string
          waiver_id: string
        }
        Insert: {
          app_version?: string | null
          family_id: string
          id?: string
          ip_address?: string | null
          signature_image_path?: string | null
          signed_at?: string
          waiver_id: string
        }
        Update: {
          app_version?: string | null
          family_id?: string
          id?: string
          ip_address?: string | null
          signature_image_path?: string | null
          signed_at?: string
          waiver_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_waivers_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_waivers_waiver_id_fkey"
            columns: ["waiver_id"]
            isOneToOne: false
            referencedRelation: "waivers"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          ip: string | null
          metadata: Json | null
          target_email: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json | null
          target_email?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json | null
          target_email?: string | null
        }
        Relationships: []
      }
      hq_invites: {
        Row: {
          claimed_at: string | null
          claimed_by_user_id: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: string
          status: string
          token_hash: string
        }
        Insert: {
          claimed_at?: string | null
          claimed_by_user_id?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          status?: string
          token_hash: string
        }
        Update: {
          claimed_at?: string | null
          claimed_by_user_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          status?: string
          token_hash?: string
        }
        Relationships: []
      }
      kid_achievements: {
        Row: {
          achievement_id: string
          earned_at: string
          id: string
          kid_id: string
          tenant_id: string
        }
        Insert: {
          achievement_id: string
          earned_at?: string
          id?: string
          kid_id: string
          tenant_id: string
        }
        Update: {
          achievement_id?: string
          earned_at?: string
          id?: string
          kid_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kid_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kid_achievements_kid_id_fkey"
            columns: ["kid_id"]
            isOneToOne: false
            referencedRelation: "kids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kid_achievements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      kid_capture_links: {
        Row: {
          associated_at: string | null
          association_status: string
          capture_source: string
          created_at: string
          external_user_id: string | null
          hittrax_registration_status: boolean | null
          hittrax_release_status: boolean | null
          id: string
          kid_id: string
          last_poll_error: string | null
          last_polled_at: string | null
          last_polled_through: string | null
          next_poll_at: string | null
          removed_at: string | null
          retry_count: number
          tenant_id: string
          third_party_user_id: string
          third_party_user_password: string | null
          updated_at: string
        }
        Insert: {
          associated_at?: string | null
          association_status?: string
          capture_source: string
          created_at?: string
          external_user_id?: string | null
          hittrax_registration_status?: boolean | null
          hittrax_release_status?: boolean | null
          id?: string
          kid_id: string
          last_poll_error?: string | null
          last_polled_at?: string | null
          last_polled_through?: string | null
          next_poll_at?: string | null
          removed_at?: string | null
          retry_count?: number
          tenant_id: string
          third_party_user_id: string
          third_party_user_password?: string | null
          updated_at?: string
        }
        Update: {
          associated_at?: string | null
          association_status?: string
          capture_source?: string
          created_at?: string
          external_user_id?: string | null
          hittrax_registration_status?: boolean | null
          hittrax_release_status?: boolean | null
          id?: string
          kid_id?: string
          last_poll_error?: string | null
          last_polled_at?: string | null
          last_polled_through?: string | null
          next_poll_at?: string | null
          removed_at?: string | null
          retry_count?: number
          tenant_id?: string
          third_party_user_id?: string
          third_party_user_password?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kid_capture_links_kid_id_fkey"
            columns: ["kid_id"]
            isOneToOne: false
            referencedRelation: "kids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kid_capture_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      kid_swing_favorites: {
        Row: {
          created_at: string
          id: string
          kid_id: string
          parent_user_id: string
          swing_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kid_id: string
          parent_user_id: string
          swing_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kid_id?: string
          parent_user_id?: string
          swing_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kid_swing_favorites_kid_id_fkey"
            columns: ["kid_id"]
            isOneToOne: false
            referencedRelation: "kids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kid_swing_favorites_swing_id_fkey"
            columns: ["swing_id"]
            isOneToOne: false
            referencedRelation: "swings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kid_swing_favorites_tenant_id_fkey"
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
          last_name: string | null
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
          last_name?: string | null
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
          last_name?: string | null
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
          cage_rental_enabled: boolean
          city: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          state: string | null
          stripe_account_id: string | null
          stripe_account_name: string | null
          stripe_onboarding_status: string
          stripe_payout_interval: string | null
          tenant_id: string
          timezone: string
          updated_at: string
          zip: string | null
        }
        Insert: {
          address?: string | null
          cage_rental_enabled?: boolean
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          state?: string | null
          stripe_account_id?: string | null
          stripe_account_name?: string | null
          stripe_onboarding_status?: string
          stripe_payout_interval?: string | null
          tenant_id: string
          timezone?: string
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address?: string | null
          cage_rental_enabled?: boolean
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          state?: string | null
          stripe_account_id?: string | null
          stripe_account_name?: string | null
          stripe_onboarding_status?: string
          stripe_payout_interval?: string | null
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
      membership_admin_events: {
        Row: {
          created_at: string
          created_by: string
          event_type: string
          id: string
          membership_id: string
          note: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          event_type: string
          id?: string
          membership_id: string
          note?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          event_type?: string
          id?: string
          membership_id?: string
          note?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_admin_events_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_admin_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_billing_date_changes: {
        Row: {
          change_type: string
          changed_by_user_id: string
          created_at: string
          effective_date: string
          id: string
          membership_id: string
          new_anchor_day: number
          old_anchor_day: number
          reverted_at: string | null
        }
        Insert: {
          change_type: string
          changed_by_user_id: string
          created_at?: string
          effective_date: string
          id?: string
          membership_id: string
          new_anchor_day: number
          old_anchor_day: number
          reverted_at?: string | null
        }
        Update: {
          change_type?: string
          changed_by_user_id?: string
          created_at?: string
          effective_date?: string
          id?: string
          membership_id?: string
          new_anchor_day?: number
          old_anchor_day?: number
          reverted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membership_billing_date_changes_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_plans: {
        Row: {
          amount_cents: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          plan_type: string
          sessions_per_week: number | null
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          plan_type: string
          sessions_per_week?: number | null
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          plan_type?: string
          sessions_per_week?: number | null
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_upgrade_requests: {
        Row: {
          created_at: string
          family_id: string
          id: string
          membership_id: string
          requested_plan_id: string
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          membership_id: string
          requested_plan_id: string
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          membership_id?: string
          requested_plan_id?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_upgrade_requests_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_upgrade_requests_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_upgrade_requests_requested_plan_id_fkey"
            columns: ["requested_plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_upgrade_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          amount_cents: number
          billing_anchor_day: number | null
          cancel_at: string | null
          cancel_effective_at: string | null
          cancel_requested_at: string | null
          cancelled_at: string | null
          contract_url: string | null
          created_at: string
          expires_at: string | null
          family_id: string
          id: string
          kid_id: string
          next_billing_at: string | null
          pause_end: string | null
          pause_start: string | null
          paused_at: string | null
          payment_failed_at: string | null
          payment_failure_count: number
          payment_pause_scheduled_at: string | null
          payment_paused_reason: string | null
          plan_name: string
          plan_type: string
          sessions_per_week: number | null
          sessions_remaining: number | null
          sessions_total: number | null
          started_at: string
          status: string
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          tenant_id: string
          updated_at: string
          weekly_period_start: string | null
          weekly_sessions_used: number
        }
        Insert: {
          amount_cents: number
          billing_anchor_day?: number | null
          cancel_at?: string | null
          cancel_effective_at?: string | null
          cancel_requested_at?: string | null
          cancelled_at?: string | null
          contract_url?: string | null
          created_at?: string
          expires_at?: string | null
          family_id: string
          id?: string
          kid_id: string
          next_billing_at?: string | null
          pause_end?: string | null
          pause_start?: string | null
          paused_at?: string | null
          payment_failed_at?: string | null
          payment_failure_count?: number
          payment_pause_scheduled_at?: string | null
          payment_paused_reason?: string | null
          plan_name: string
          plan_type: string
          sessions_per_week?: number | null
          sessions_remaining?: number | null
          sessions_total?: number | null
          started_at?: string
          status?: string
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id: string
          updated_at?: string
          weekly_period_start?: string | null
          weekly_sessions_used?: number
        }
        Update: {
          amount_cents?: number
          billing_anchor_day?: number | null
          cancel_at?: string | null
          cancel_effective_at?: string | null
          cancel_requested_at?: string | null
          cancelled_at?: string | null
          contract_url?: string | null
          created_at?: string
          expires_at?: string | null
          family_id?: string
          id?: string
          kid_id?: string
          next_billing_at?: string | null
          pause_end?: string | null
          pause_start?: string | null
          paused_at?: string | null
          payment_failed_at?: string | null
          payment_failure_count?: number
          payment_pause_scheduled_at?: string | null
          payment_paused_reason?: string | null
          plan_name?: string
          plan_type?: string
          sessions_per_week?: number | null
          sessions_remaining?: number | null
          sessions_total?: number | null
          started_at?: string
          status?: string
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id?: string
          updated_at?: string
          weekly_period_start?: string | null
          weekly_sessions_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "memberships_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_kid_id_fkey"
            columns: ["kid_id"]
            isOneToOne: false
            referencedRelation: "kids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          event_type: string
          id: string
          kid_id: string | null
          period_key: string
          sent_at: string
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          event_type: string
          id?: string
          kid_id?: string | null
          period_key: string
          sent_at?: string
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          event_type?: string
          id?: string
          kid_id?: string | null
          period_key?: string
          sent_at?: string
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_kid_id_fkey"
            columns: ["kid_id"]
            isOneToOne: false
            referencedRelation: "kids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount_paid_cents: number | null
          amount_paid_points: number | null
          created_at: string
          family_id: string
          fulfilled_at: string | null
          fulfilled_by_user_id: string | null
          id: string
          kid_id: string
          payment_method: string
          product_id: string
          redemption_code: string
          status: string
          stripe_payment_intent_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_paid_cents?: number | null
          amount_paid_points?: number | null
          created_at?: string
          family_id: string
          fulfilled_at?: string | null
          fulfilled_by_user_id?: string | null
          id?: string
          kid_id: string
          payment_method: string
          product_id: string
          redemption_code: string
          status?: string
          stripe_payment_intent_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_paid_cents?: number | null
          amount_paid_points?: number | null
          created_at?: string
          family_id?: string
          fulfilled_at?: string | null
          fulfilled_by_user_id?: string | null
          id?: string
          kid_id?: string
          payment_method?: string
          product_id?: string
          redemption_code?: string
          status?: string
          stripe_payment_intent_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_kid_id_fkey"
            columns: ["kid_id"]
            isOneToOne: false
            referencedRelation: "kids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          amount_cents: number
          created_at: string
          error_code: string | null
          family_id: string
          id: string
          membership_id: string | null
          payment_method: string
          status: string
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          tenant_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          error_code?: string | null
          family_id: string
          id?: string
          membership_id?: string | null
          payment_method: string
          status: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          tenant_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          error_code?: string | null
          family_id?: string
          id?: string
          membership_id?: string | null
          payment_method?: string
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_events_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_bests: {
        Row: {
          achieved_at: string
          created_at: string
          id: string
          kid_id: string
          metric: string
          swing_id: string | null
          tenant_id: string
          updated_at: string
          value: number
        }
        Insert: {
          achieved_at: string
          created_at?: string
          id?: string
          kid_id: string
          metric: string
          swing_id?: string | null
          tenant_id: string
          updated_at?: string
          value: number
        }
        Update: {
          achieved_at?: string
          created_at?: string
          id?: string
          kid_id?: string
          metric?: string
          swing_id?: string | null
          tenant_id?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "personal_bests_kid_id_fkey"
            columns: ["kid_id"]
            isOneToOne: false
            referencedRelation: "kids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_bests_swing_id_fkey"
            columns: ["swing_id"]
            isOneToOne: false
            referencedRelation: "swings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_bests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_init: {
        Row: {
          id: number
          initialized_at: string
          initialized_by_user_id: string | null
        }
        Insert: {
          id?: number
          initialized_at?: string
          initialized_by_user_id?: string | null
        }
        Update: {
          id?: number
          initialized_at?: string
          initialized_by_user_id?: string | null
        }
        Relationships: []
      }
      points_ledger: {
        Row: {
          balance_after: number
          created_at: string
          delta: number
          id: string
          kid_id: string
          note: string | null
          reason: string
          reference_id: string | null
          reference_type: string | null
          tenant_id: string
        }
        Insert: {
          balance_after: number
          created_at?: string
          delta: number
          id?: string
          kid_id: string
          note?: string | null
          reason: string
          reference_id?: string | null
          reference_type?: string | null
          tenant_id: string
        }
        Update: {
          balance_after?: number
          created_at?: string
          delta?: number
          id?: string
          kid_id?: string
          note?: string | null
          reason?: string
          reference_id?: string | null
          reference_type?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_ledger_kid_id_fkey"
            columns: ["kid_id"]
            isOneToOne: false
            referencedRelation: "kids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_ledger_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          created_at: string
          description: string | null
          dollar_price_cents: number | null
          id: string
          image_url: string | null
          inventory_count: number | null
          is_active: boolean
          is_purchasable: boolean
          is_redeemable: boolean
          name: string
          points_cost: number | null
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          dollar_price_cents?: number | null
          id?: string
          image_url?: string | null
          inventory_count?: number | null
          is_active?: boolean
          is_purchasable?: boolean
          is_redeemable?: boolean
          name: string
          points_cost?: number | null
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          dollar_price_cents?: number | null
          id?: string
          image_url?: string | null
          inventory_count?: number | null
          is_active?: boolean
          is_purchasable?: boolean
          is_redeemable?: boolean
          name?: string
          points_cost?: number | null
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          applicable_plan_names: string[]
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_redemptions: number | null
          redemptions_used: number
          stripe_coupon_id: string | null
          stripe_promotion_code_id: string | null
          tenant_id: string
        }
        Insert: {
          applicable_plan_names?: string[]
          code: string
          created_at?: string
          discount_type: string
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          redemptions_used?: number
          stripe_coupon_id?: string | null
          stripe_promotion_code_id?: string | null
          tenant_id: string
        }
        Update: {
          applicable_plan_names?: string[]
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          redemptions_used?: number
          stripe_coupon_id?: string | null
          stripe_promotion_code_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_codes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_charges: {
        Row: {
          amount_cents: number
          charge_date: string
          created_at: string
          failure_reason: string | null
          family_id: string
          id: string
          membership_id: string
          status: string
          stripe_payment_intent_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          charge_date: string
          created_at?: string
          failure_reason?: string | null
          family_id: string
          id?: string
          membership_id: string
          status?: string
          stripe_payment_intent_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          charge_date?: string
          created_at?: string
          failure_reason?: string | null
          family_id?: string
          id?: string
          membership_id?: string
          status?: string
          stripe_payment_intent_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_charges_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_charges_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_charges_tenant_id_fkey"
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
          capacity: number
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
          capacity?: number
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
          capacity?: number
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
      sessions: {
        Row: {
          avg_exit_velocity_mph: number | null
          best_exit_velocity_mph: number | null
          booking_id: string | null
          capture_session_id: string | null
          capture_source: string
          coach_id: string | null
          created_at: string
          ended_at: string | null
          facility_id: string | null
          id: string
          kid_id: string
          max_distance_ft: number | null
          notes: string | null
          started_at: string
          swing_count: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          avg_exit_velocity_mph?: number | null
          best_exit_velocity_mph?: number | null
          booking_id?: string | null
          capture_session_id?: string | null
          capture_source: string
          coach_id?: string | null
          created_at?: string
          ended_at?: string | null
          facility_id?: string | null
          id?: string
          kid_id: string
          max_distance_ft?: number | null
          notes?: string | null
          started_at: string
          swing_count?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          avg_exit_velocity_mph?: number | null
          best_exit_velocity_mph?: number | null
          booking_id?: string | null
          capture_session_id?: string | null
          capture_source?: string
          coach_id?: string | null
          created_at?: string
          ended_at?: string | null
          facility_id?: string | null
          id?: string
          kid_id?: string
          max_distance_ft?: number | null
          notes?: string | null
          started_at?: string
          swing_count?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_kid_id_fkey"
            columns: ["kid_id"]
            isOneToOne: false
            referencedRelation: "kids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_locations: {
        Row: {
          created_at: string
          id: string
          location_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admins: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      swings: {
        Row: {
          capture_event_id: string
          capture_source: string
          contact_quality: string | null
          created_at: string
          distance_ft: number | null
          exit_velocity_mph: number | null
          id: string
          is_personal_best: boolean
          kid_id: string
          launch_angle_deg: number | null
          occurred_at: string
          pitch_speed_mph: number | null
          raw: Json | null
          result: string | null
          session_id: string | null
          spray_angle_deg: number | null
          tenant_id: string
        }
        Insert: {
          capture_event_id: string
          capture_source: string
          contact_quality?: string | null
          created_at?: string
          distance_ft?: number | null
          exit_velocity_mph?: number | null
          id?: string
          is_personal_best?: boolean
          kid_id: string
          launch_angle_deg?: number | null
          occurred_at: string
          pitch_speed_mph?: number | null
          raw?: Json | null
          result?: string | null
          session_id?: string | null
          spray_angle_deg?: number | null
          tenant_id: string
        }
        Update: {
          capture_event_id?: string
          capture_source?: string
          contact_quality?: string | null
          created_at?: string
          distance_ft?: number | null
          exit_velocity_mph?: number | null
          id?: string
          is_personal_best?: boolean
          kid_id?: string
          launch_angle_deg?: number | null
          occurred_at?: string
          pitch_speed_mph?: number | null
          raw?: Json | null
          result?: string | null
          session_id?: string | null
          spray_angle_deg?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "swings_kid_id_fkey"
            columns: ["kid_id"]
            isOneToOne: false
            referencedRelation: "kids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_config: {
        Row: {
          allow_cross_location_booking: boolean
          booking_cancel_fee_cents: number
          booking_cancel_window_hours: number
          created_at: string
          id: string
          membership_cancel_notice_days: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          allow_cross_location_booking?: boolean
          booking_cancel_fee_cents?: number
          booking_cancel_window_hours?: number
          created_at?: string
          id?: string
          membership_cancel_notice_days?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          allow_cross_location_booking?: boolean
          booking_cancel_fee_cents?: number
          booking_cancel_window_hours?: number
          created_at?: string
          id?: string
          membership_cancel_notice_days?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          tenant_id: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          tenant_id: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          tenant_id?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
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
          contact_email: string | null
          created_at: string
          id: string
          name: string
          royalty_config: Json
          slug: string
          stripe_account_id: string | null
          updated_at: string
        }
        Insert: {
          brand_colors?: Json
          brand_logo_url?: string | null
          contact_email?: string | null
          created_at?: string
          id?: string
          name: string
          royalty_config?: Json
          slug: string
          stripe_account_id?: string | null
          updated_at?: string
        }
        Update: {
          brand_colors?: Json
          brand_logo_url?: string | null
          contact_email?: string | null
          created_at?: string
          id?: string
          name?: string
          royalty_config?: Json
          slug?: string
          stripe_account_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      training_video_views: {
        Row: {
          id: string
          kid_id: string
          tenant_id: string
          training_video_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          kid_id: string
          tenant_id: string
          training_video_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          kid_id?: string
          tenant_id?: string
          training_video_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_video_views_kid_id_fkey"
            columns: ["kid_id"]
            isOneToOne: false
            referencedRelation: "kids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_video_views_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_video_views_training_video_id_fkey"
            columns: ["training_video_id"]
            isOneToOne: false
            referencedRelation: "training_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      training_videos: {
        Row: {
          category: string
          coach_name: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_sec: number | null
          featured: boolean
          id: string
          level: string
          mux_playback_id: string
          published_at: string | null
          tenant_id: string
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          category: string
          coach_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_sec?: number | null
          featured?: boolean
          id?: string
          level?: string
          mux_playback_id: string
          published_at?: string | null
          tenant_id: string
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          category?: string
          coach_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_sec?: number | null
          featured?: boolean
          id?: string
          level?: string
          mux_playback_id?: string
          published_at?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "training_videos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          mux_asset_id: string
          mux_playback_id: string | null
          purpose: string
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
          purpose?: string
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
          purpose?: string
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
      waivers: {
        Row: {
          body_text: string
          created_at: string
          effective_date: string
          id: string
          is_active: boolean
          tenant_id: string
          version: number
        }
        Insert: {
          body_text: string
          created_at?: string
          effective_date?: string
          id?: string
          is_active?: boolean
          tenant_id: string
          version: number
        }
        Update: {
          body_text?: string
          created_at?: string
          effective_date?: string
          id?: string
          is_active?: boolean
          tenant_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "waivers_tenant_id_fkey"
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
      _get_caller_tenant_family_ids: { Args: never; Returns: string[] }
      _grant_achievement: {
        Args: { p_key: string; p_kid_id: string }
        Returns: undefined
      }
      _video_in_tenant: {
        Args: { p_tenant_id: string; p_video_id: string }
        Returns: boolean
      }
      _video_is_parent_upload: {
        Args: { p_tenant_id: string; p_user_id: string; p_video_id: string }
        Returns: boolean
      }
      activate_membership_with_scheduled_charge: {
        Args: {
          p_amount_cents: number
          p_charge_date: string
          p_family_id: string
          p_membership_id: string
          p_tenant_id: string
        }
        Returns: undefined
      }
      book_session_with_friend: {
        Args: {
          p_coach_id: string
          p_guest_email?: string
          p_guest_name: string
          p_guest_phone?: string
          p_kid_id: string
          p_location_id: string
          p_scheduled_end: string
          p_scheduled_start: string
          p_session_type_id: string
          p_tenant_id: string
        }
        Returns: Json
      }
      cancel_assignment_for_coach: {
        Args: { p_assignment_id: string }
        Returns: string
      }
      cancel_booking: {
        Args: { p_booking_id: string; p_override?: boolean; p_reason?: string }
        Returns: Json
      }
      cancel_membership: {
        Args: { p_membership_id: string; p_override?: boolean }
        Returns: Json
      }
      check_in_booking: { Args: { p_booking_id: string }; Returns: Json }
      check_session_credits: {
        Args: { p_kid_id: string; p_tenant_id: string }
        Returns: number
      }
      claim_waitlist_spot: { Args: { p_waitlist_id: string }; Returns: Json }
      complete_assignment_for_kid: {
        Args: { p_assignment_id: string }
        Returns: {
          assignment_id: string
          new_balance: number
          points_credited: number
        }[]
      }
      consume_promo_code: {
        Args: { p_code: string; p_plan_name?: string }
        Returns: Json
      }
      create_public_booking: {
        Args: {
          p_coach_id: string
          p_kid_id: string
          p_location_id: string
          p_scheduled_start: string
          p_session_type_id: string
          p_tenant_slug: string
        }
        Returns: {
          booking_id: string
        }[]
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      deduct_session_credit: { Args: { p_booking_id: string }; Returns: number }
      deduct_session_credits: {
        Args: { p_kid_id: string; p_n: number }
        Returns: number
      }
      expire_stale_waitlist_entries: { Args: never; Returns: undefined }
      gen_redemption_code: { Args: never; Returns: string }
      get_coach_hours: {
        Args: { p_end_date: string; p_start_date: string; p_tenant_id: string }
        Returns: {
          cancelled_count: number
          coach_id: string
          coach_name: string
          completed_count: number
          confirmed_count: number
          no_show_count: number
          total_hours: number
        }[]
      }
      get_day_slot_availability: {
        Args: {
          p_end: string
          p_session_type_id: string
          p_start: string
          p_tenant_id: string
        }
        Returns: {
          capacity: number
          confirmed_count: number
          session_slot_key: string
          waitlist_count: number
        }[]
      }
      get_hittrax_leaderboard: {
        Args: {
          p_age_group?: string
          p_location_id?: string
          p_metric: string
          p_scope?: string
        }
        Returns: {
          age_group: string
          first_name: string
          kid_id: string
          last_name: string
          rank: number
          value: number
        }[]
      }
      get_kid_weekly_rank_delta: { Args: { p_kid_id: string }; Returns: number }
      get_lesson_count_leaderboard: {
        Args: { p_location_id?: string }
        Returns: {
          first_name: string
          kid_id: string
          last_name: string
          lesson_count: number
          rank: number
        }[]
      }
      get_my_coach_id: { Args: never; Returns: string }
      get_my_coach_preset: { Args: never; Returns: string }
      get_public_availability: {
        Args: {
          p_date_range_end: string
          p_date_range_start: string
          p_duration_minutes?: number
          p_tenant_slug: string
        }
        Returns: {
          coach_first_name: string
          coach_id: string
          coach_last_name: string
          end_time: string
          is_available: boolean
          location_id: string
          location_name: string
          slot_date: string
          start_time: string
        }[]
      }
      get_public_session_types: {
        Args: { p_tenant_slug: string }
        Returns: {
          base_price_cents: number
          description: string
          duration_minutes: number
          id: string
          name: string
          type_category: string
        }[]
      }
      get_public_tenant_info: {
        Args: { p_tenant_slug: string }
        Returns: {
          brand_colors: Json
          brand_logo_url: string
          id: string
          name: string
          slug: string
        }[]
      }
      join_waitlist: {
        Args: {
          p_coach_id: string
          p_location_id: string
          p_scheduled_end: string
          p_scheduled_start: string
          p_session_slot_key: string
          p_session_type_id: string
        }
        Returns: {
          claim_deadline: string | null
          coach_id: string
          created_at: string
          family_id: string
          id: string
          kid_id: string
          location_id: string
          notified_at: string | null
          position: number
          scheduled_end: string
          scheduled_start: string
          session_slot_key: string
          session_type_id: string
          status: string
          tenant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "booking_waitlist"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      leave_waitlist: { Args: { p_waitlist_id: string }; Returns: undefined }
      mark_coach_message_viewed: {
        Args: { p_message_id: string }
        Returns: undefined
      }
      mark_no_show: { Args: { p_booking_id: string }; Returns: Json }
      mark_redemption_fulfilled: {
        Args: { p_code: string }
        Returns: {
          amount_paid_cents: number | null
          amount_paid_points: number | null
          created_at: string
          family_id: string
          fulfilled_at: string | null
          fulfilled_by_user_id: string | null
          id: string
          kid_id: string
          payment_method: string
          product_id: string
          redemption_code: string
          status: string
          stripe_payment_intent_id: string | null
          tenant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_redemption_fulfilled_staff: {
        Args: { p_code: string }
        Returns: {
          amount_paid_cents: number | null
          amount_paid_points: number | null
          created_at: string
          family_id: string
          fulfilled_at: string | null
          fulfilled_by_user_id: string | null
          id: string
          kid_id: string
          payment_method: string
          product_id: string
          redemption_code: string
          status: string
          stripe_payment_intent_id: string | null
          tenant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pause_membership: {
        Args: { p_membership_id: string; p_pause_end: string }
        Returns: Json
      }
      publish_waiver_version: {
        Args: {
          p_body_text: string
          p_effective_date: string
          p_tenant_id: string
        }
        Returns: {
          new_effective_date: string
          new_id: string
          new_version: number
        }[]
      }
      record_training_view: {
        Args: { p_kid_id: string; p_video_id: string }
        Returns: boolean
      }
      redeem_reward_for_kid: {
        Args: { p_kid_id: string; p_product_id: string }
        Returns: {
          new_balance: number
          order_id: string
          redemption_code: string
        }[]
      }
      register_device_token: {
        Args: { p_expo_push_token: string; p_platform: string }
        Returns: undefined
      }
      restore_session_credit: {
        Args: { p_booking_id: string }
        Returns: number
      }
      resume_membership: { Args: { p_membership_id: string }; Returns: Json }
      review_assignment: {
        Args: { p_assignment_id: string; p_feedback: string; p_rating: number }
        Returns: {
          coach_user_id: string
          created_at: string
          description: string | null
          drill_video_id: string | null
          due_date: string | null
          duration_estimate_minutes: number | null
          family_id: string
          feedback: string | null
          id: string
          kid_id: string
          point_reward: number
          rating: number | null
          reviewed_at: string | null
          status: string
          submitted_at: string | null
          submitted_video_url: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sign_waiver: {
        Args: { p_app_version?: string; p_waiver_id: string }
        Returns: undefined
      }
      toggle_swing_favorite: { Args: { p_swing_id: string }; Returns: boolean }
      undo_check_in: { Args: { p_booking_id: string }; Returns: Json }
      update_assignment_for_coach: {
        Args: {
          p_assignment_id: string
          p_description: string
          p_drill_video_id: string
          p_due_date: string
          p_title: string
        }
        Returns: {
          coach_user_id: string
          created_at: string
          description: string | null
          drill_video_id: string | null
          due_date: string | null
          duration_estimate_minutes: number | null
          family_id: string
          feedback: string | null
          id: string
          kid_id: string
          point_reward: number
          rating: number | null
          reviewed_at: string | null
          status: string
          submitted_at: string | null
          submitted_video_url: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      validate_promo_code: {
        Args: { p_code: string; p_plan_name?: string }
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
