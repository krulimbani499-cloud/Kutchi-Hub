
CREATE OR REPLACE FUNCTION public.enforce_review_update_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin boolean;
  v_is_owner boolean;
BEGIN
  -- Admins can update anything
  SELECT public.has_role(auth.uid(), 'admin') INTO v_is_admin;
  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- Review author: may only edit rating/review (NOT owner_reply fields)
  IF NEW.user_id = auth.uid() AND OLD.user_id = auth.uid() THEN
    IF NEW.owner_reply     IS DISTINCT FROM OLD.owner_reply
    OR NEW.owner_reply_at  IS DISTINCT FROM OLD.owner_reply_at
    OR NEW.business_id     IS DISTINCT FROM OLD.business_id
    OR NEW.user_id         IS DISTINCT FROM OLD.user_id
    OR NEW.helpful_count   IS DISTINCT FROM OLD.helpful_count
    OR NEW.created_at      IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Reviewers may only edit their rating and review text';
    END IF;
    RETURN NEW;
  END IF;

  -- Business owner reply path: only owner_reply/owner_reply_at may change
  SELECT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = NEW.business_id AND b.owner_id = auth.uid()
  ) INTO v_is_owner;

  IF v_is_owner THEN
    IF NEW.rating        IS DISTINCT FROM OLD.rating
    OR NEW.review        IS DISTINCT FROM OLD.review
    OR NEW.user_id       IS DISTINCT FROM OLD.user_id
    OR NEW.business_id   IS DISTINCT FROM OLD.business_id
    OR NEW.helpful_count IS DISTINCT FROM OLD.helpful_count
    OR NEW.created_at    IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Business owners may only edit owner_reply fields on reviews';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Not authorized to update this review';
END;
$function$;

-- Ensure the trigger is attached
DROP TRIGGER IF EXISTS enforce_review_update_columns_trg ON public.business_reviews;
CREATE TRIGGER enforce_review_update_columns_trg
BEFORE UPDATE ON public.business_reviews
FOR EACH ROW EXECUTE FUNCTION public.enforce_review_update_columns();
