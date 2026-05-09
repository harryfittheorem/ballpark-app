-- =============================================================================
-- Seed catalog for the Train tab (v0.7 task #121).
-- =============================================================================
-- 12 placeholder videos so the Train tab demos out of the box on launch.
-- All rows point at the public Mux test asset (Big Buck Bunny variant) the
-- Mux team ships with their docs — admins can swap mux_playback_id from
-- /admin/training-videos as real footage is uploaded.
--
-- Idempotent on (title, tenant_id) via a partial unique-style guard: we
-- INSERT ... ON CONFLICT DO NOTHING after creating a unique index scoped
-- to the seed rows. Re-running this file is a no-op once seeded.
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS training_videos_tenant_title_unique
  ON public.training_videos (tenant_id, title);

INSERT INTO public.training_videos
  (tenant_id, mux_playback_id, title, description, category, level, coach_name, duration_sec, featured, published_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'DS00Spx1CV902MCtPj5WknGlR102V5HFkDe',
   'Tee work fundamentals',                'Pure mechanics on the tee — foot placement, hand path, finish.',
   'hitting',     'beginner',     'Coach Mike',     320, true,  now()),

  ('00000000-0000-0000-0000-000000000001', 'DS00Spx1CV902MCtPj5WknGlR102V5HFkDe',
   'Soft toss to the back side',           'Driving the ball to the opposite field with intent.',
   'hitting',     'intermediate', 'Coach Mike',     265, false, now()),

  ('00000000-0000-0000-0000-000000000001', 'DS00Spx1CV902MCtPj5WknGlR102V5HFkDe',
   'Front foot timing drill',              'Loading on time, rotating through contact.',
   'hitting',     'intermediate', 'Coach Pete',     410, false, now()),

  ('00000000-0000-0000-0000-000000000001', 'DS00Spx1CV902MCtPj5WknGlR102V5HFkDe',
   'Two-strike approach',                  'Shorter swing, choke up, battle the count.',
   'hitting',     'advanced',     'Coach Mike',     290, false, now()),

  ('00000000-0000-0000-0000-000000000001', 'DS00Spx1CV902MCtPj5WknGlR102V5HFkDe',
   'Pre-pitch breathing',                  'Box breathing reset between pitches to stay calm.',
   'mental',      'beginner',     'Coach Sam',      180, true,  now()),

  ('00000000-0000-0000-0000-000000000001', 'DS00Spx1CV902MCtPj5WknGlR102V5HFkDe',
   'Visualizing the at-bat',               'Mental rehearsal before stepping in the box.',
   'mental',      'intermediate', 'Coach Sam',      240, false, now()),

  ('00000000-0000-0000-0000-000000000001', 'DS00Spx1CV902MCtPj5WknGlR102V5HFkDe',
   'Bounce-back routine',                  'What to do in your head right after a strikeout.',
   'mental',      'advanced',     'Coach Sam',      300, false, now()),

  ('00000000-0000-0000-0000-000000000001', 'DS00Spx1CV902MCtPj5WknGlR102V5HFkDe',
   'Reading a runner from first',          'Holding runners and picking up secondary leads.',
   'situational', 'beginner',     'Coach Pete',     270, false, now()),

  ('00000000-0000-0000-0000-000000000001', 'DS00Spx1CV902MCtPj5WknGlR102V5HFkDe',
   'Hitting behind the runner',            'Moving runners over with situational hitting.',
   'situational', 'intermediate', 'Coach Pete',     320, false, now()),

  ('00000000-0000-0000-0000-000000000001', 'DS00Spx1CV902MCtPj5WknGlR102V5HFkDe',
   'Bunting for a hit',                    'Drag bunts and squares — when and how.',
   'situational', 'advanced',     'Coach Pete',     360, false, now()),

  ('00000000-0000-0000-0000-000000000001', 'DS00Spx1CV902MCtPj5WknGlR102V5HFkDe',
   'Infield ready position',               'Footwork and glove work on every pitch.',
   'fielding',    'beginner',     'Coach Mike',     230, false, now()),

  ('00000000-0000-0000-0000-000000000001', 'DS00Spx1CV902MCtPj5WknGlR102V5HFkDe',
   'Outfield reads off the bat',           'First-step quickness and route running.',
   'fielding',    'intermediate', 'Coach Mike',     390, false, now())
ON CONFLICT (tenant_id, title) DO NOTHING;
