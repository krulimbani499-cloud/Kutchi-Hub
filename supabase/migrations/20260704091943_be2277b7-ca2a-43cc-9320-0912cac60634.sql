
-- Make new business submissions require admin approval
ALTER TABLE public.businesses ALTER COLUMN status SET DEFAULT 'pending';

-- Auto-grant admin role to the designated email once verified
CREATE OR REPLACE FUNCTION public.grant_admin_for_designated_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND lower(NEW.email) = 'krutarthlimbani499@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_grant_designated_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_grant_designated_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_admin_for_designated_email();

DROP TRIGGER IF EXISTS on_auth_user_confirmed_grant_designated_admin ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_grant_designated_admin
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.grant_admin_for_designated_email();

-- Backfill if the user already exists and is verified
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users
WHERE lower(email) = 'krutarthlimbani499@gmail.com'
  AND email_confirmed_at IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;
