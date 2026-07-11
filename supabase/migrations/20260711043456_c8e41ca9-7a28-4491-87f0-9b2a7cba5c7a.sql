DROP POLICY "Authenticated users can log events" ON public.business_events;
CREATE POLICY "Authenticated users can log events" ON public.business_events
FOR INSERT TO authenticated, anon
WITH CHECK (
  EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_events.business_id)
  AND (user_id IS NULL OR user_id = auth.uid())
);