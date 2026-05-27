-- Add 'bring_a_friend' to the points_ledger reason allow-list.
-- The book_session_with_friend RPC awards 100 pts with reason='bring_a_friend',
-- but this value was missing from the CHECK constraint, causing the entire
-- transaction to roll back on every BAF booking attempt.

ALTER TABLE public.points_ledger
  DROP CONSTRAINT points_ledger_reason_check,
  ADD  CONSTRAINT points_ledger_reason_check
    CHECK (reason = ANY (ARRAY[
      'session_attended',
      'assignment_completed',
      'pr_hit',
      'redemption',
      'manual_adjustment',
      'achievement_bonus',
      'booking_cancelled',
      'bring_a_friend'
    ]));
