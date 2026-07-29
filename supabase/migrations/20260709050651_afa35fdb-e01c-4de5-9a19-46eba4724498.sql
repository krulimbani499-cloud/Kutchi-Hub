-- Allow authenticated users to create new categories (needed when listing a business)
CREATE POLICY "Authenticated users can create categories"
ON public.categories
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);