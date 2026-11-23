-- Standardized exit reason enum for cancelled memberships (W48)
-- Allowed values: Schedule, Price, Distance, Competitor, Quit Sport, Other

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS cancellation_reason text
    CHECK (cancellation_reason IS NULL OR cancellation_reason IN
      ('Schedule', 'Price', 'Distance', 'Competitor', 'Quit Sport', 'Other'));
