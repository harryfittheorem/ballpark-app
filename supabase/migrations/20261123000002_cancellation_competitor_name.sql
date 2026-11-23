-- Competitor name field for cancellations where exit reason is "Competitor" (W49)
-- Free-text, max 120 characters. Null unless cancellation_reason = 'Competitor'.

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS competitor_name text
    CHECK (competitor_name IS NULL OR char_length(competitor_name) <= 120);
