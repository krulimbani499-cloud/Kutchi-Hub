
-- 1) Rate-limit trigger for discount_claims (per user, per business, per day)
CREATE OR REPLACE FUNCTION public.enforce_discount_claim_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count INT;
BEGIN
  IF NEW.user_id IS NULL THEN
    -- Anonymous claims: allow (no user to rate-limit); tighten later if needed.
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO recent_count
  FROM public.discount_claims
  WHERE user_id = NEW.user_id
    AND business_id = NEW.business_id
    AND claimed_at > (now() - interval '24 hours');

  IF recent_count >= 1 THEN
    RAISE EXCEPTION 'You have already claimed this discount recently. Please try again later.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_discount_claim_rate_limit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS discount_claims_rate_limit_trigger ON public.discount_claims;
CREATE TRIGGER discount_claims_rate_limit_trigger
BEFORE INSERT ON public.discount_claims
FOR EACH ROW EXECUTE FUNCTION public.enforce_discount_claim_rate_limit();

-- 2) Audit log expansions
CREATE OR REPLACE FUNCTION public.log_business_verified_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.verified IS DISTINCT FROM OLD.verified THEN
    INSERT INTO public.audit_logs (event_type, actor_id, target_user_id, details)
    VALUES (
      CASE WHEN NEW.verified THEN 'business_verified' ELSE 'business_unverified' END,
      auth.uid(),
      NEW.owner_id,
      jsonb_build_object('business_id', NEW.id, 'business_name', NEW.name)
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_business_verified_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS businesses_verified_audit_trigger ON public.businesses;
CREATE TRIGGER businesses_verified_audit_trigger
AFTER UPDATE OF verified ON public.businesses
FOR EACH ROW EXECUTE FUNCTION public.log_business_verified_change();

CREATE OR REPLACE FUNCTION public.log_category_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (event_type, actor_id, details)
  VALUES ('category_deleted', auth.uid(),
          jsonb_build_object('category_id', OLD.id, 'name', OLD.name, 'slug', OLD.slug));
  RETURN OLD;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_category_delete() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS categories_delete_audit_trigger ON public.categories;
CREATE TRIGGER categories_delete_audit_trigger
AFTER DELETE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.log_category_delete();

CREATE OR REPLACE FUNCTION public.log_banner_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (event_type, actor_id, details)
  VALUES ('banner_ad_deleted', auth.uid(),
          jsonb_build_object('banner_id', OLD.id, 'title', OLD.title));
  RETURN OLD;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_banner_delete() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS banner_ads_delete_audit_trigger ON public.banner_ads;
CREATE TRIGGER banner_ads_delete_audit_trigger
AFTER DELETE ON public.banner_ads
FOR EACH ROW EXECUTE FUNCTION public.log_banner_delete();
