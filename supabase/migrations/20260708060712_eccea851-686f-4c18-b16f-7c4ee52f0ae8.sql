CREATE TABLE public.discount_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  code text NOT NULL,
  discount_percent smallint,
  claimed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.discount_claims TO authenticated;
GRANT INSERT ON public.discount_claims TO anon;
GRANT ALL ON public.discount_claims TO service_role;

ALTER TABLE public.discount_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create a discount claim"
  ON public.discount_claims
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Owner or admin can view business claims"
  ON public.discount_claims
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = discount_claims.business_id
        AND b.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own claims"
  ON public.discount_claims
  FOR SELECT
  USING (user_id IS NOT NULL AND user_id = auth.uid());

CREATE INDEX discount_claims_business_id_idx
  ON public.discount_claims (business_id, claimed_at DESC);
CREATE INDEX discount_claims_user_id_idx
  ON public.discount_claims (user_id)
  WHERE user_id IS NOT NULL;