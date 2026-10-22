-- ============================================================================
-- PUSH NOTIFICATION TOKENS (iOS app). The app saves the phone's APNs token for the signed-in person
-- (src/lib/devices.functions.ts -> registerDeviceToken). Sending pushes is a separate server job (docs/ios-app.md).
--
-- STATUS: NOT APPLIED. Write-only: nothing here has been run. Revert: 02_revert.sql. Verify: 03_verify.sql.
-- Until this runs, the app still works: registerDeviceToken answers { ok: false } and nothing else is affected.
--
-- Tokens are written by the server with the service key (a phone that changes owner just moves its row), so the app users
-- only get to READ and DELETE their own rows. Deleting an account removes its tokens (ON DELETE CASCADE).
-- ============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.device_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token      text NOT NULL,
  platform   text NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT device_tokens_token_key UNIQUE (token)
);
CREATE INDEX IF NOT EXISTS device_tokens_user_idx ON public.device_tokens (user_id);

GRANT SELECT, DELETE ON public.device_tokens TO authenticated;
GRANT ALL ON public.device_tokens TO service_role;

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own device tokens" ON public.device_tokens;
CREATE POLICY "Users can view their own device tokens"
  ON public.device_tokens FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own device tokens" ON public.device_tokens;
CREATE POLICY "Users can delete their own device tokens"
  ON public.device_tokens FOR DELETE TO authenticated
  USING (user_id = auth.uid());

COMMIT;
