
DROP POLICY IF EXISTS "Users can view their own claims" ON public.business_claims;

CREATE POLICY "Claim visibility"
  ON public.business_claims
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_claims.business_id
        AND b.owner_id = auth.uid()
    )
  );
