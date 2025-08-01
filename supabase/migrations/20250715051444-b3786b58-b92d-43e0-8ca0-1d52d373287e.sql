-- Enhanced TTL migration for vibe sessions with production-grade optimizations

-- 1️⃣ Ensure pg_cron extension exists
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2️⃣ Create partial index for efficient cron queries
CREATE INDEX IF NOT EXISTS idx_user_vibe_states_expirable
  ON public.user_vibe_states (updated_at)
  WHERE active = TRUE;

-- 3️⃣ One-off cleanup of existing stale vibes (safe to re-run)
UPDATE public.user_vibe_states
SET    active = FALSE
WHERE  active = TRUE
  AND  updated_at < (now() - interval '90 minutes');

-- 4️⃣ Schedule background job only if it doesn't exist (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
       SELECT 1 FROM cron.job
       WHERE jobname = 'floq_expire_stale_vibes'
     ) THEN
    PERFORM
      cron.schedule(
        'floq_expire_stale_vibes',     -- unique name to avoid collisions
        '*/10 * * * *',                -- every 10 minutes
        $$ SET search_path TO public;
           UPDATE user_vibe_states
           SET    active = FALSE
           WHERE  active = TRUE
           AND    updated_at < (now() - interval '90 minutes'); $$
      );
  END IF;
END
$$;