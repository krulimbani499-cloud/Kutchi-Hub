
-- business_events: require authenticated
DROP POLICY IF EXISTS "Anyone can log events" ON public.business_events;
CREATE POLICY "Authenticated users can log events"
ON public.business_events
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_events.business_id));

-- discount_claims: require authenticated and tie to user
DROP POLICY IF EXISTS "Create claim on active discount only" ON public.discount_claims;
CREATE POLICY "Create claim on active discount only"
ON public.discount_claims
FOR INSERT
TO authenticated
WITH CHECK (
  user_id IS NOT NULL
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = discount_claims.business_id
      AND b.app_discount_percent IS NOT NULL
      AND b.app_discount_percent > 0
      AND (b.app_discount_valid_until IS NULL OR b.app_discount_valid_until >= CURRENT_DATE)
  )
);
