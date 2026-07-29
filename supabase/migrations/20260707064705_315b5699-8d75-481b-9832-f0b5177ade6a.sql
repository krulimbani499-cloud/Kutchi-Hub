
-- 1) business_enquiries: restrict owner UPDATE columns via column-level GRANTs
REVOKE UPDATE ON public.business_enquiries FROM authenticated;
GRANT UPDATE (status) ON public.business_enquiries TO authenticated;

-- 2) business_reviews: restrict UPDATE columns via column-level GRANTs.
-- Reviewers and owners both act as 'authenticated'; the enforce_review_update_columns()
-- trigger further restricts which of these columns each party may actually change.
-- helpful_count is intentionally excluded so it can never be tampered with via the Data API.
REVOKE UPDATE ON public.business_reviews FROM authenticated;
GRANT UPDATE (rating, review, owner_reply, owner_reply_at, updated_at)
  ON public.business_reviews TO authenticated;
