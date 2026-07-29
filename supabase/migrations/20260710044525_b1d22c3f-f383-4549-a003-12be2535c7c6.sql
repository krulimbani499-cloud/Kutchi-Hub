-- Trim existing whitespace so city filters match
UPDATE public.businesses
SET
  city = btrim(city),
  name = btrim(name),
  slug = btrim(slug)
WHERE
  city IS DISTINCT FROM btrim(city)
  OR name IS DISTINCT FROM btrim(name)
  OR slug IS DISTINCT FROM btrim(slug);

-- Trigger to auto-trim on insert/update going forward
CREATE OR REPLACE FUNCTION public.trim_business_text_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.city IS NOT NULL THEN NEW.city := btrim(NEW.city); END IF;
  IF NEW.name IS NOT NULL THEN NEW.name := btrim(NEW.name); END IF;
  IF NEW.slug IS NOT NULL THEN NEW.slug := btrim(NEW.slug); END IF;
  IF NEW.state IS NOT NULL THEN NEW.state := btrim(NEW.state); END IF;
  IF NEW.address IS NOT NULL THEN NEW.address := btrim(NEW.address); END IF;
  IF NEW.pincode IS NOT NULL THEN NEW.pincode := btrim(NEW.pincode); END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trim_business_text_fields_trigger ON public.businesses;
CREATE TRIGGER trim_business_text_fields_trigger
BEFORE INSERT OR UPDATE ON public.businesses
FOR EACH ROW EXECUTE FUNCTION public.trim_business_text_fields();