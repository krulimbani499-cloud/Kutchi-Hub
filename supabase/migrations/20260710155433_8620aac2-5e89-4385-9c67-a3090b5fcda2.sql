-- 1) Restrict business_enquiries INSERT to authenticated users only and require user_id = auth.uid()
DROP POLICY IF EXISTS "Anyone can create enquiry" ON public.business_enquiries;

CREATE POLICY "Authenticated users can create enquiry"
ON public.business_enquiries
FOR INSERT
TO authenticated
WITH CHECK (
  user_id IS NOT NULL
  AND user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_enquiries.business_id)
);

REVOKE INSERT ON public.business_enquiries FROM anon;

-- 2) Attach column-level protection trigger on business_reviews so reviewers cannot
--    forge owner_reply / owner_reply_at, and owners cannot edit rating/review text.
DROP TRIGGER IF EXISTS enforce_review_update_columns_trg ON public.business_reviews;
CREATE TRIGGER enforce_review_update_columns_trg
BEFORE UPDATE ON public.business_reviews
FOR EACH ROW EXECUTE FUNCTION public.enforce_review_update_columns();