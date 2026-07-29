-- Referral program

-- 1) Add referral_code to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- Function to generate a short unique code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  code TEXT;
  exists_count INT;
BEGIN
  LOOP
    -- 6-char uppercase alphanumeric
    code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
    SELECT count(*) INTO exists_count FROM public.profiles WHERE referral_code = code;
    EXIT WHEN exists_count = 0;
  END LOOP;
  RETURN code;
END;
$$;

-- Backfill existing profiles
UPDATE public.profiles
SET referral_code = public.generate_referral_code()
WHERE referral_code IS NULL;

-- Ensure new profiles get a code
CREATE OR REPLACE FUNCTION public.set_referral_code_on_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := public.generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_referral_code ON public.profiles;
CREATE TRIGGER profiles_set_referral_code
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_referral_code_on_profile();

-- 2) Referrals table
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_used TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'rewarded',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (referred_id),
  CHECK (referrer_id <> referred_id)
);

GRANT SELECT, INSERT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their own referrals (as referrer or referred)"
ON public.referrals FOR SELECT
TO authenticated
USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

-- 3) RPC to apply a referral code (called by new user)
CREATE OR REPLACE FUNCTION public.apply_referral_code(_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_referrer UUID;
  v_created TIMESTAMPTZ;
  v_existing UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Only new users within 14 days can apply
  SELECT created_at INTO v_created FROM auth.users WHERE id = v_uid;
  IF v_created IS NULL OR v_created < now() - interval '14 days' THEN
    RAISE EXCEPTION 'Referral code can only be applied within 14 days of signup';
  END IF;

  -- Already used?
  SELECT referrer_id INTO v_existing FROM public.referrals WHERE referred_id = v_uid;
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'You already applied a referral code';
  END IF;

  -- Find referrer
  SELECT user_id INTO v_referrer FROM public.profiles WHERE referral_code = upper(_code);
  IF v_referrer IS NULL THEN
    RAISE EXCEPTION 'Invalid referral code';
  END IF;
  IF v_referrer = v_uid THEN
    RAISE EXCEPTION 'You cannot use your own referral code';
  END IF;

  -- Insert referral
  INSERT INTO public.referrals (referrer_id, referred_id, code_used, status)
  VALUES (v_referrer, v_uid, upper(_code), 'rewarded');

  -- Award points to both
  INSERT INTO public.point_events (user_id, action, points, metadata)
  VALUES
    (v_referrer, 'referral_bonus', 100, jsonb_build_object('referred_id', v_uid)),
    (v_uid, 'referral_welcome', 50, jsonb_build_object('referrer_id', v_referrer));

  RETURN jsonb_build_object('ok', true, 'referrer_id', v_referrer);
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_referral_code(TEXT) TO authenticated;