DROP POLICY IF EXISTS "Anyone can create a discount claim" ON public.discount_claims;

CREATE POLICY "Create claim on active discount only"
  ON public.discount_claims
  FOR INSERT
  WITH CHECK (
    (user_id IS NULL OR user_id = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.businesses b
      WHERE b.id = discount_claims.business_id
        AND b.app_discount_percent IS NOT NULL
        AND b.app_discount_percent > 0
        AND (
          b.app_discount_valid_until IS NULL
          OR b.app_discount_valid_until >= CURRENT_DATE
        )
    )
  );