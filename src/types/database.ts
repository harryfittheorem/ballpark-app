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
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
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
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
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
      memberships: {
        Row: {
          amount_cents: number
          billing_anchor_day: number | null
          cancelled_at: string | null
          created_at: string
          family_id: string
          id: string
          kid_id: string
          plan_name: string
          plan_type: string
          started_at: string
          status: string
          stripe_subscription_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          billing_anchor_day?: number | null
          cancelled_at?: string | null
          created_at?: string
          family_id: string
          id?: string
          kid_id: string
          plan_name: string
          plan_type: string
          started_at?: string
          status?: string
          stripe_subscription_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          billing_anchor_day?: number | null
          cancelled_at?: string | null
          created_at?: string
          family_id?: string
          id?: string
          kid_id?: string
          plan_name?: string
          plan_type?: string
          started_at?: string
          status?: string
          stripe_subscription_id?: string | null
          tenant_id?: string
          updated_at?: string
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
      sessions: {
        Row: {
          avg_exit_velocity_mph: number | null
          best_exit_velocity_mph: number | null
          capture_session_id: string | null
          capture_source: string
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
          capture_session_id?: string | null
          capture_source: string
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
          capture_session_id?: string | null
          capture_source?: string
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
          created_at: string
          id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          allow_cross_location_booking?: boolean
          created_at?: string
          id?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          allow_cross_location_booking?: boolean
          created_at?: string
          id?: string
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
      tenants: {
        Row: {
          brand_colors: Json
          brand_logo_url: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      cancel_assignment_for_coach: {
        Args: { p_assignment_id: string }
        Returns: string
      }
      complete_assignment_for_kid: {
        Args: { p_assignment_id: string }
        Returns: {
          assignment_id: string
          new_balance: number
          points_credited: number
        }[]
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
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
      get_kid_weekly_rank_delta: { Args: { p_kid_id: string }; Returns: number }
      mark_coach_message_viewed: {
        Args: { p_message_id: string }
        Returns: undefined
      }
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
      toggle_swing_favorite: { Args: { p_swing_id: string }; Returns: boolean }
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
