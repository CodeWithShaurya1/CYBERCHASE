-- ==============================================================================
-- CSI TECHVERSE // CYBERCHASE — ONE-ATTEMPT-PER-STUDENT & LEADERBOARD SCHEMA
-- ==============================================================================
-- Run this script in your Supabase Dashboard:
-- 1. Go to https://supabase.com/dashboard/project/ursfmqitvpkupgasggaz
-- 2. Open the "SQL Editor" tab from the left sidebar
-- 3. Click "New query", paste this entire script, and click "Run" (▶)
-- ==============================================================================

-- 1. Create or alter the shared leaderboard table
CREATE TABLE IF NOT EXISTS public.cyberchase_leaderboard (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  enrollment TEXT NOT NULL,
  normalized_enrollment TEXT,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  score INTEGER NOT NULL DEFAULT 0,
  accuracy INTEGER NOT NULL DEFAULT 0,
  correct_answers INTEGER NOT NULL DEFAULT 0,
  wrong_answers INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  fragments INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure columns exist if table was previously created
ALTER TABLE public.cyberchase_leaderboard 
  ADD COLUMN IF NOT EXISTS normalized_enrollment TEXT;

ALTER TABLE public.cyberchase_leaderboard 
  ADD COLUMN IF NOT EXISTS attempt_number INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.cyberchase_leaderboard 
  ADD COLUMN IF NOT EXISTS scoring_version TEXT DEFAULT 'v2';

-- Backfill normalized_enrollment for any legacy records
UPDATE public.cyberchase_leaderboard 
SET normalized_enrollment = upper(trim(enrollment))
WHERE normalized_enrollment IS NULL;

-- Mark legacy records created before scoring overhaul as v1
UPDATE public.cyberchase_leaderboard 
SET scoring_version = 'v1'
WHERE scoring_version IS NULL;

-- 2. Create the Authorizations table for approved repeat attempts
CREATE TABLE IF NOT EXISTS public.cyberchase_authorizations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  normalized_enrollment TEXT NOT NULL,
  authorized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at TIMESTAMPTZ,
  created_by TEXT DEFAULT 'ADMIN'
);

-- Indexes for performance and lookup
CREATE INDEX IF NOT EXISTS idx_cyberchase_ranking 
  ON public.cyberchase_leaderboard (score DESC, accuracy DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_cyberchase_enrollment_lookup 
  ON public.cyberchase_leaderboard (normalized_enrollment);

CREATE INDEX IF NOT EXISTS idx_cyberchase_auth_lookup 
  ON public.cyberchase_authorizations (normalized_enrollment, used_at);

-- 3. Trigger Function: Enforce strict One-Attempt policy & manage repeat attempts
CREATE OR REPLACE FUNCTION public.trg_enforce_one_attempt()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_norm TEXT;
  v_attempts INT;
  v_auth_id BIGINT;
BEGIN
  -- Normalize enrollment consistently: trim and uppercase
  v_norm := upper(trim(NEW.enrollment));
  NEW.normalized_enrollment := v_norm;

  -- Count previous attempts for this student
  SELECT count(*) INTO v_attempts
  FROM public.cyberchase_leaderboard
  WHERE normalized_enrollment = v_norm;

  IF v_attempts = 0 THEN
    -- First attempt: permitted by default
    NEW.attempt_number := 1;
    RETURN NEW;
  END IF;

  -- Repeat attempt detected: Check for an unused admin authorization with row lock
  SELECT id INTO v_auth_id
  FROM public.cyberchase_authorizations
  WHERE normalized_enrollment = v_norm 
    AND used_at IS NULL
  ORDER BY authorized_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_auth_id IS NOT NULL THEN
    -- Admin authorized this repeat attempt: mark authorization as used
    UPDATE public.cyberchase_authorizations
    SET used_at = NOW()
    WHERE id = v_auth_id;

    -- Record as separate repeat attempt (attempt 2, 3...)
    NEW.attempt_number := v_attempts + 1;
    RETURN NEW;
  ELSE
    -- Unauthorized repeat attempt blocked at database level!
    RAISE EXCEPTION 'STUDENT_ALREADY_PLAYED: Enrollment % has already completed attempt % and is not authorized for another attempt.', 
      v_norm, v_attempts 
      USING ERRCODE = '23505';
  END IF;
END;
$$;

-- Attach trigger to cyberchase_leaderboard
DROP TRIGGER IF EXISTS trg_check_student_attempt ON public.cyberchase_leaderboard;
CREATE TRIGGER trg_check_student_attempt
  BEFORE INSERT ON public.cyberchase_leaderboard
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enforce_one_attempt();

-- 4. RPC: Check Student Eligibility (called before game starts)
-- Does NOT expose previous scores or personal data
CREATE OR REPLACE FUNCTION public.check_student_eligibility(p_enrollment TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm TEXT;
  v_attempts INT;
  v_has_auth BOOLEAN;
BEGIN
  IF p_enrollment IS NULL OR trim(p_enrollment) = '' THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'EMPTY_ENROLLMENT');
  END IF;

  v_norm := upper(trim(p_enrollment));

  -- Count recorded completed attempts
  SELECT count(*) INTO v_attempts
  FROM public.cyberchase_leaderboard
  WHERE normalized_enrollment = v_norm;

  IF v_attempts = 0 THEN
    RETURN jsonb_build_object(
      'eligible', true, 
      'attempts', 0, 
      'hasAuthorization', false
    );
  END IF;

  -- Check if an unused admin authorization exists
  SELECT EXISTS(
    SELECT 1 FROM public.cyberchase_authorizations
    WHERE normalized_enrollment = v_norm AND used_at IS NULL
  ) INTO v_has_auth;

  IF v_has_auth THEN
    RETURN jsonb_build_object(
      'eligible', true, 
      'attempts', v_attempts, 
      'hasAuthorization', true
    );
  ELSE
    RETURN jsonb_build_object(
      'eligible', false, 
      'attempts', v_attempts, 
      'hasAuthorization', false
    );
  END IF;
END;
$$;

-- Grant access to eligibility RPC for anon and authenticated users
GRANT EXECUTE ON FUNCTION public.check_student_eligibility(TEXT) TO anon, authenticated, service_role;

-- 5. Optional Secure In-Database Admin Verification (RPC fallback)
-- Creates private schema to store admin key hash if edge function is not deployed
CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE IF NOT EXISTS private.admin_config (
  id INT PRIMARY KEY DEFAULT 1,
  admin_key_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_config CHECK (id = 1)
);

-- Configured Admin Key Hash (SHA-256)
INSERT INTO private.admin_config (id, admin_key_hash)
VALUES (1, 'fec670eaa6b7732ddd1fab99a102d1413c7c439fcd8f3fdc2310d458ad2036bc')
ON CONFLICT (id) DO UPDATE SET admin_key_hash = EXCLUDED.admin_key_hash, updated_at = NOW();

-- RPC to verify admin key and grant attempt authorization
CREATE OR REPLACE FUNCTION public.verify_admin_and_authorize(p_enrollment TEXT, p_admin_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_norm TEXT;
  v_expected_hash TEXT;
  v_provided_hash TEXT;
BEGIN
  IF p_enrollment IS NULL OR trim(p_enrollment) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Enrollment number is required');
  END IF;

  IF p_admin_key IS NULL OR trim(p_admin_key) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid admin key');
  END IF;

  v_norm := upper(trim(p_enrollment));
  v_provided_hash := encode(sha256(trim(p_admin_key)::bytea), 'hex');

  SELECT admin_key_hash INTO v_expected_hash FROM private.admin_config WHERE id = 1;

  IF v_expected_hash IS NULL OR v_expected_hash != v_provided_hash THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid admin key');
  END IF;

  -- Key matches! Insert unused authorization
  INSERT INTO public.cyberchase_authorizations (normalized_enrollment, created_by, authorized_at, used_at)
  VALUES (v_norm, 'ADMIN_RPC', NOW(), NULL);

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Attempt authorized successfully',
    'enrollment', v_norm
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_admin_and_authorize(TEXT, TEXT) TO anon, authenticated, service_role;

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.cyberchase_leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cyberchase_authorizations ENABLE ROW LEVEL SECURITY;

-- Clean up any existing policies
DROP POLICY IF EXISTS "Allow public read" ON public.cyberchase_leaderboard;
DROP POLICY IF EXISTS "Allow public insert" ON public.cyberchase_leaderboard;
DROP POLICY IF EXISTS "Deny direct public write on authorizations" ON public.cyberchase_authorizations;

-- Leaderboard policies
CREATE POLICY "Allow public read"
  ON public.cyberchase_leaderboard
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert"
  ON public.cyberchase_leaderboard
  FOR INSERT
  WITH CHECK (
    score >= 0 AND 
    accuracy >= 0 AND 
    accuracy <= 100 AND
    length(trim(name)) > 0 AND 
    length(trim(enrollment)) > 0
  );

-- Authorizations table is NOT directly writable by anon key; only via SECURITY DEFINER functions or Service Role
CREATE POLICY "Deny direct public write on authorizations"
  ON public.cyberchase_authorizations
  FOR ALL
  USING (false);

-- 7. Enable Realtime broadcast on leaderboard (idempotent check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'cyberchase_leaderboard'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cyberchase_leaderboard;
  END IF;
END $$;
