
-- Public read of business photos (bucket is private but readable via RLS + public URL)
CREATE POLICY "Public read business photos"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'business-photos');

-- Owners (or admins) upload into their own business's folder: business-photos/{business_id}/...
CREATE POLICY "Owners insert business photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'business-photos'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id::text = (storage.foldername(name))[1]
        AND b.owner_id = auth.uid()
    )
  )
);

CREATE POLICY "Owners update business photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'business-photos'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id::text = (storage.foldername(name))[1]
        AND b.owner_id = auth.uid()
    )
  )
);

CREATE POLICY "Owners delete business photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'business-photos'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id::text = (storage.foldername(name))[1]
        AND b.owner_id = auth.uid()
    )
  )
);
