export type CRMView = 'overview' | 'inbox' | 'pipeline' | 'workflows';
export type CRMEvent = { id: string; kind: string; author: string; body: string; status: string; at: string; simulated: boolean };
export type CRMThread = {
  id: string; parent: string; athlete: string; age: number; phone: string;
  family_id?: string; kid_id?: string; stage: string; revision: number;
  hold: string | null; consent: boolean; verified: boolean; owner: string | null;
  voice_consent?: boolean; recipient_timezone?: string;
  sms_draft: string; note_draft: string; selection: string | null;
  booking: { id: string; starts_at: string; status: string } | null;
  callback: { id: string; reason: string; question: string; due: string; status: string; owner: string } | null;
  events: CRMEvent[]; offered: string[]; nurture: { status: string; reason: string; due: string; version: number };
};
export type CRMSlot = { id: string; starts_at: string; ends_at: string; coach: string; cage: string; available: boolean };
export type CRMState = {
  location: { id: string; name: string; timezone: string; sender: string; connection: string; simulated: boolean };
  threads: CRMThread[]; slots: CRMSlot[];
  workflow: { version: number; enabled: boolean; delay_minutes: number; wording: string; authority: 'draft' | 'delegated'; knowledge: string; history: { at: string; actor: string; version: number; reason: string }[] };
  internal_tasks?: { id: string; kid_id: string; due_at: string; reason: string; status: string }[];
  reminders?: { booking_id: string; due_at: string; reason: string; status: string; revision: number }[];
};
export type CRMCommand = {
  kind: string; thread_id?: string; revision?: number; key: string;
  text?: string; slot_id?: string; outcome?: string; delay_minutes?: number;
  enabled?: boolean; authority?: string; verified_family_id?: string; verified_kid_id?: string;
  source?: 'agent'; recipient_timezone?: string;
  channel?: 'sms' | 'voice';
  task_id?: string;
  parent_name?: string; athlete_name?: string; athlete_age?: number;
};
export const PREVIEW_LOCATION = '20000000-0000-0000-0000-000000000001';
