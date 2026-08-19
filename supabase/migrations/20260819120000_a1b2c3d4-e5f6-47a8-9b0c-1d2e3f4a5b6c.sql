-- Public bucket for admin-uploaded marketing banner images.
-- Unlike business-photos (private, signed URLs), banner images are rendered
-- directly via <img src={image_url}> on the homepage, so they need a stable
-- public URL rather than an expiring signed one.
INSERT INTO storage.buckets (id, name, public)
VALUES ('banner-images', 'banner-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read banner images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'banner-images');

CREATE POLICY "Admins insert banner images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'banner-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update banner images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'banner-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete banner images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'banner-images' AND public.has_role(auth.uid(), 'admin'));
