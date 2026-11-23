-- Player demographics: birthday + sport type (W23)
ALTER TABLE public.kids
  ADD COLUMN IF NOT EXISTS birthday date,
  ADD COLUMN IF NOT EXISTS sport_type text CHECK (sport_type IN ('baseball', 'softball', 'both'));
