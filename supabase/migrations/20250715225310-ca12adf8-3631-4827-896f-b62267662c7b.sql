-- Clean up conflicting username functions to fix "username taken" and "user not found" issues

-- Drop all existing conflicting username functions
DROP FUNCTION IF EXISTS public.username_exists(text);
DROP FUNCTION IF EXISTS public.username_available(text);
DROP FUNCTION IF EXISTS public.update_username(text);
DROP FUNCTION IF EXISTS public.get_user_by_username(text);

-- Recreate username_available function (returns true if username is available)
CREATE OR REPLACE FUNCTION public.username_available(u text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE lower(p.username::text) = lower(u)
  );
$$;

GRANT EXECUTE ON FUNCTION public.username_available(text) TO anon, authenticated;

-- Recreate update_username function
CREATE OR REPLACE FUNCTION public.update_username(p_username text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  -- Validation
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  IF length(trim(p_username)) < 3 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Username must be at least 3 characters');
  END IF;
  
  IF NOT (p_username ~ '^[a-zA-Z0-9_]{3,32}$') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid username format');
  END IF;
  
  -- Check if username is already taken (case-insensitive)
  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username::text) = lower(p_username) AND id != current_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Username is already taken');
  END IF;
  
  -- Update the username (store as lowercase)
  UPDATE public.profiles 
  SET username = lower(p_username)::citext, updated_at = now()
  WHERE id = current_user_id;
  
  RETURN jsonb_build_object('success', true, 'username', lower(p_username));
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_username(text) TO authenticated;

-- Recreate get_user_by_username function (case-insensitive lookup)
CREATE OR REPLACE FUNCTION public.get_user_by_username(lookup_username text)
RETURNS TABLE (
  id uuid,
  username citext,
  display_name text,
  avatar_url text,
  bio text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.bio
  FROM public.profiles p
  WHERE lower(p.username::text) = lower(lookup_username)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_by_username(text) TO anon, authenticated;