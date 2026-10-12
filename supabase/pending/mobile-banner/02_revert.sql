-- Reverts 01_migration.sql. This deletes any mobile banner image URLs saved in the column
-- (the uploaded files in the banner-images bucket are not touched).
-- Deploy the previous code first (or at least code that no longer selects mobile_image_url).
ALTER TABLE public.banner_ads DROP COLUMN IF EXISTS mobile_image_url;
