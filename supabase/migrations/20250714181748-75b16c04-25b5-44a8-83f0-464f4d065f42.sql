-- Comprehensive fix for unread count backend engine
-- Addresses all identified production readiness issues

-- Phase 1A: Schema Corrections

-- 1. Add missing FK constraints
ALTER TABLE public.user_floq_activity_tracking
  ADD CONSTRAINT fk_tracking_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_tracking_floq FOREIGN KEY (floq_id) REFERENCES public.floqs(id) ON DELETE CASCADE;

-- 2. Fix trigger naming and make it SECURITY DEFINER
DROP TRIGGER IF EXISTS touch_updated_at ON public.user_floq_activity_tracking;

CREATE OR REPLACE FUNCTION _tracking_touch_updated_at()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tracking_touch_updated_at
BEFORE UPDATE ON public.user_floq_activity_tracking
FOR EACH ROW EXECUTE FUNCTION _tracking_touch_updated_at();

-- 3. Clean up duplicate triggers
DROP TRIGGER IF EXISTS initialize_tracking_on_join ON public.floq_participants;

-- 4. Fix update_user_activity_tracking function with proper column aliases
CREATE OR REPLACE FUNCTION public.update_user_activity_tracking(
  p_floq_id uuid,
  p_section text DEFAULT 'all'
) RETURNS void
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public 
AS $$
BEGIN
  INSERT INTO public.user_floq_activity_tracking (user_id, floq_id)
  VALUES (auth.uid(), p_floq_id)
  ON CONFLICT (user_id, floq_id) DO UPDATE
  SET last_chat_viewed_at = 
        CASE WHEN p_section IN ('all','chat') THEN now()
             ELSE public.user_floq_activity_tracking.last_chat_viewed_at END,
      last_activity_viewed_at = 
        CASE WHEN p_section IN ('all','activity') THEN now()
             ELSE public.user_floq_activity_tracking.last_activity_viewed_at END,
      last_plans_viewed_at = 
        CASE WHEN p_section IN ('all','plans') THEN now()
             ELSE public.user_floq_activity_tracking.last_plans_viewed_at END,
      updated_at = now();
  
  RETURN;
END;
$$;

-- Phase 1B: View and Index Optimizations

-- 5. Fix user_floq_unread_counts view for Postgres 15 compatibility
DROP VIEW IF EXISTS public.user_floq_unread_counts;

CREATE VIEW public.user_floq_unread_counts
SECURITY INVOKER
AS
SELECT 
  fp.user_id,
  fp.floq_id,
  COALESCE(
    (SELECT COUNT(*)::integer 
     FROM public.floq_messages fm 
     WHERE fm.floq_id = fp.floq_id 
       AND fm.sender_id != fp.user_id
       AND fm.created_at > COALESCE(uat.last_chat_viewed_at, COALESCE(fp.joined_at, '1970-01-01'::timestamptz))
    ), 0
  ) AS unread_chat,
  
  COALESCE(
    (SELECT COUNT(*)::integer 
     FROM public.flock_history fh 
     WHERE fh.floq_id = fp.floq_id 
       AND fh.user_id != fp.user_id
       AND fh.created_at > COALESCE(uat.last_activity_viewed_at, COALESCE(fp.joined_at, '1970-01-01'::timestamptz))
    ), 0
  ) AS unread_activity,
  
  COALESCE(
    (SELECT COUNT(*)::integer 
     FROM public.floq_plans fpl 
     WHERE fpl.floq_id = fp.floq_id 
       AND fpl.creator_id != fp.user_id
       AND fpl.created_at > COALESCE(uat.last_plans_viewed_at, COALESCE(fp.joined_at, '1970-01-01'::timestamptz))
    ), 0
  ) AS unread_plans,
  
  COALESCE(
    (SELECT COUNT(*)::integer 
     FROM public.floq_messages fm 
     WHERE fm.floq_id = fp.floq_id 
       AND fm.sender_id != fp.user_id
       AND fm.created_at > COALESCE(uat.last_chat_viewed_at, COALESCE(fp.joined_at, '1970-01-01'::timestamptz))
    ), 0
  ) +
  COALESCE(
    (SELECT COUNT(*)::integer 
     FROM public.flock_history fh 
     WHERE fh.floq_id = fp.floq_id 
       AND fh.user_id != fp.user_id
       AND fh.created_at > COALESCE(uat.last_activity_viewed_at, COALESCE(fp.joined_at, '1970-01-01'::timestamptz))
    ), 0
  ) +
  COALESCE(
    (SELECT COUNT(*)::integer 
     FROM public.floq_plans fpl 
     WHERE fpl.floq_id = fp.floq_id 
       AND fpl.creator_id != fp.user_id
       AND fpl.created_at > COALESCE(uat.last_plans_viewed_at, COALESCE(fp.joined_at, '1970-01-01'::timestamptz))
    ), 0
  ) AS unread_total

FROM public.floq_participants fp
LEFT JOIN public.user_floq_activity_tracking uat 
  ON uat.user_id = fp.user_id AND uat.floq_id = fp.floq_id;

-- 6. Optimize indexes with fixed horizons instead of mutable now()
DROP INDEX IF EXISTS idx_floq_messages_unread_tracking;
DROP INDEX IF EXISTS idx_flock_history_unread_tracking;
DROP INDEX IF EXISTS idx_floq_plans_unread_tracking;

-- Messages index with sender filter for excluding own messages
CREATE INDEX idx_floq_messages_unread_tracking 
  ON public.floq_messages (floq_id, created_at DESC) 
  INCLUDE (sender_id)
  WHERE created_at > (CURRENT_DATE - INTERVAL '90 days');

-- History index for activity tracking
CREATE INDEX idx_flock_history_unread_tracking 
  ON public.flock_history (floq_id, created_at DESC) 
  INCLUDE (user_id)
  WHERE created_at > (CURRENT_DATE - INTERVAL '90 days');

-- Plans index for plan notifications
CREATE INDEX idx_floq_plans_unread_tracking 
  ON public.floq_plans (floq_id, created_at DESC) 
  INCLUDE (creator_id)
  WHERE created_at > (CURRENT_DATE - INTERVAL '90 days');

-- Phase 1C: Security and Grants

-- 7. Re-grant SELECT permissions after view recreation
GRANT SELECT ON public.user_floq_unread_counts TO authenticated;

-- Ensure proper permissions on the tracking table
GRANT SELECT, INSERT, UPDATE ON public.user_floq_activity_tracking TO authenticated;

-- Grant execute on the tracking function
GRANT EXECUTE ON FUNCTION public.update_user_activity_tracking(uuid, text) TO authenticated;

-- Phase 1D: Bootstrap Data with Proper Transaction Handling

-- 8. Initialize tracking records for existing participants (in batches)
DO $$
DECLARE
  batch_size INTEGER := 1000;
  processed INTEGER := 0;
  total_count INTEGER;
BEGIN
  -- Get total count for logging
  SELECT COUNT(*) INTO total_count
  FROM public.floq_participants fp
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_floq_activity_tracking uat
    WHERE uat.user_id = fp.user_id AND uat.floq_id = fp.floq_id
  );
  
  RAISE NOTICE 'Initializing tracking for % existing participants', total_count;
  
  -- Process in batches to avoid long locks
  LOOP
    WITH batch AS (
      SELECT fp.user_id, fp.floq_id, COALESCE(fp.joined_at, '1970-01-01'::timestamptz) as joined_at
      FROM public.floq_participants fp
      WHERE NOT EXISTS (
        SELECT 1 FROM public.user_floq_activity_tracking uat
        WHERE uat.user_id = fp.user_id AND uat.floq_id = fp.floq_id
      )
      LIMIT batch_size
    )
    INSERT INTO public.user_floq_activity_tracking (
      user_id, 
      floq_id, 
      last_chat_viewed_at,
      last_activity_viewed_at, 
      last_plans_viewed_at
    )
    SELECT 
      user_id, 
      floq_id, 
      joined_at,
      joined_at,
      joined_at
    FROM batch;
    
    GET DIAGNOSTICS processed = ROW_COUNT;
    
    IF processed = 0 THEN
      EXIT;
    END IF;
    
    RAISE NOTICE 'Processed % rows', processed;
    
    -- Small delay to prevent overwhelming the system
    PERFORM pg_sleep(0.1);
  END LOOP;
  
  RAISE NOTICE 'Bootstrap initialization completed';
END;
$$;