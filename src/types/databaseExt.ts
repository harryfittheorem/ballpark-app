/**
 * Local augmentation of the generated Supabase Database types for the
 * `public.coach_messages` columns added by migration
 * `20260509000000_v07_parent_to_coach_messages.sql` (label, sender_display,
 * recipient_coach_user_id) and the `public.videos.purpose` value
 * `'parent_to_coach'`.
 *
 * This file is the SINGLE place that bridges the gap until
 * `src/types/database.ts` is regenerated against the dev DB. Use
 * `supabaseExt` from `@/lib/supabase` (re-exported below) wherever you
 * need to insert/select these columns with full type safety — no `any`
 * casts, no per-call workarounds.
 */

import type { Database } from './database';

type CoachMessagesTable = Database['public']['Tables']['coach_messages'];
type CoachMessagesExtRow = CoachMessagesTable['Row'] & {
  label: string | null;
  sender_display: string | null;
  recipient_coach_user_id: string | null;
};
type CoachMessagesExtInsert = CoachMessagesTable['Insert'] & {
  label?: string | null;
  sender_display?: string | null;
  recipient_coach_user_id?: string | null;
};
type CoachMessagesExtUpdate = CoachMessagesTable['Update'] & {
  label?: string | null;
  sender_display?: string | null;
  recipient_coach_user_id?: string | null;
};

export type DatabaseExt = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables'> & {
    Tables: Omit<Database['public']['Tables'], 'coach_messages'> & {
      coach_messages: Omit<CoachMessagesTable, 'Row' | 'Insert' | 'Update'> & {
        Row: CoachMessagesExtRow;
        Insert: CoachMessagesExtInsert;
        Update: CoachMessagesExtUpdate;
      };
    };
  };
};
