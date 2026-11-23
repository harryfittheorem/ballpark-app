-- Exit interview + waiver fields for membership cancellation (W57)
-- exit_interview_requested: set when parent/member requests an exit interview before cancelling
-- waiver_authorized: set by staff after in-person exit interview to waive the notice fee

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS exit_interview_requested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exit_interview_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS waiver_authorized boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS waiver_authorized_by text,
  ADD COLUMN IF NOT EXISTS waiver_authorized_at timestamptz;
