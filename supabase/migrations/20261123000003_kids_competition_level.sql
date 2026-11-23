-- Rec vs Travel tag for player profiles (W45)
-- competition_level: 'Rec', 'Travel', or 'Both'

ALTER TABLE public.kids
  ADD COLUMN IF NOT EXISTS competition_level text
    CHECK (competition_level IS NULL OR competition_level IN ('Rec', 'Travel', 'Both'));
