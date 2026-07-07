-- Fix business-photos storage policies: reference storage.objects.name, not businesses.name
DROP POLICY IF EXISTS "Owners insert business photos" ON storage.objects;
DROP POLICY IF EXISTS "Owners update business photos" ON storage.objects;
DROP POLICY IF EXISTS "Owners delete business photos" ON storage.objects;

CREATE POLICY "Owners insert business photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'business-photos'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id::text = (storage.foldername(storage.objects.name))[1]
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
      WHERE b.id::text = (storage.foldername(storage.objects.name))[1]
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
      WHERE b.id::text = (storage.foldername(storage.objects.name))[1]
        AND b.owner_id = auth.uid()
    )
  )
);