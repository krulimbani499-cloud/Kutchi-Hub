
CREATE OR REPLACE FUNCTION public.notify_owner_on_review()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner UUID; biz_name TEXT; biz_slug TEXT;
BEGIN
  SELECT owner_id, name, slug INTO owner, biz_name, biz_slug FROM public.businesses WHERE id = NEW.business_id;
  IF owner IS NOT NULL AND owner <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, type, title, body, link_url, entity_type, entity_id)
    VALUES (owner, 'new_review', 'New review on ' || biz_name,
            'You received a new ' || NEW.rating || '★ review.',
            '/business/' || biz_slug, 'review', NEW.id);
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.notify_owner_on_review() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS reviews_notify_owner_trigger ON public.business_reviews;
CREATE TRIGGER reviews_notify_owner_trigger
AFTER INSERT ON public.business_reviews
FOR EACH ROW EXECUTE FUNCTION public.notify_owner_on_review();

CREATE OR REPLACE FUNCTION public.notify_owner_on_enquiry()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner UUID; biz_name TEXT;
BEGIN
  SELECT owner_id, name INTO owner, biz_name FROM public.businesses WHERE id = NEW.business_id;
  IF owner IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link_url, entity_type, entity_id)
    VALUES (owner, 'new_enquiry', 'New enquiry for ' || biz_name,
            NEW.name || ' is interested. ' || COALESCE(NEW.service_needed, ''),
            '/dashboard', 'enquiry', NEW.id);
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.notify_owner_on_enquiry() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enquiries_notify_owner_trigger ON public.business_enquiries;
CREATE TRIGGER enquiries_notify_owner_trigger
AFTER INSERT ON public.business_enquiries
FOR EACH ROW EXECUTE FUNCTION public.notify_owner_on_enquiry();
