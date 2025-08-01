-- Add sample user_vibe_states entries for testing
-- These will populate the live data that feeds into clusters

INSERT INTO public.user_vibe_states (user_id, vibe_tag, location, started_at, active) VALUES
-- SF Bay Area active vibes
('11111111-1111-1111-1111-111111111111', 'chill', ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326), now() - interval '10 minutes', true),
('22222222-2222-2222-2222-222222222222', 'hype', ST_SetSRID(ST_MakePoint(-122.4094, 37.7849), 4326), now() - interval '5 minutes', true),
('33333333-3333-3333-3333-333333333333', 'focus', ST_SetSRID(ST_MakePoint(-122.4294, 37.7649), 4326), now() - interval '15 minutes', true),
('44444444-4444-4444-4444-444444444444', 'explore', ST_SetSRID(ST_MakePoint(-122.4394, 37.7549), 4326), now() - interval '8 minutes', true),

-- LA Area active vibes  
('11111111-1111-1111-1111-111111111111', 'chill', ST_SetSRID(ST_MakePoint(-118.2437, 34.0522), 4326), now() - interval '12 minutes', true),
('22222222-2222-2222-2222-222222222222', 'hype', ST_SetSRID(ST_MakePoint(-118.2537, 34.0622), 4326), now() - interval '7 minutes', true),
('33333333-3333-3333-3333-333333333333', 'social', ST_SetSRID(ST_MakePoint(-118.2337, 34.0422), 4326), now() - interval '20 minutes', true),
('44444444-4444-4444-4444-444444444444', 'explore', ST_SetSRID(ST_MakePoint(-118.2637, 34.0322), 4326), now() - interval '3 minutes', true),

-- Additional spread around both cities for realistic density
('55555555-5555-5555-5555-555555555555', 'chill', ST_SetSRID(ST_MakePoint(-122.4100 + (random() - 0.5) * 0.1, 37.7700 + (random() - 0.5) * 0.1), 4326), now() - interval '25 minutes', true),
('66666666-6666-6666-6666-666666666666', 'hype', ST_SetSRID(ST_MakePoint(-122.4200 + (random() - 0.5) * 0.1, 37.7800 + (random() - 0.5) * 0.1), 4326), now() - interval '18 minutes', true),
('77777777-7777-7777-7777-777777777777', 'focus', ST_SetSRID(ST_MakePoint(-118.2400 + (random() - 0.5) * 0.2, 34.0500 + (random() - 0.5) * 0.15), 4326), now() - interval '13 minutes', true),
('88888888-8888-8888-8888-888888888888', 'social', ST_SetSRID(ST_MakePoint(-118.2500 + (random() - 0.5) * 0.2, 34.0600 + (random() - 0.5) * 0.15), 4326), now() - interval '9 minutes', true)

ON CONFLICT (user_id) DO UPDATE SET
  vibe_tag = EXCLUDED.vibe_tag,
  location = EXCLUDED.location,
  started_at = EXCLUDED.started_at,
  active = EXCLUDED.active;