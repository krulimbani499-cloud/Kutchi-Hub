-- Optional taller (2:1, e.g. 1200 x 600) banner image for phones. Desktop keeps using image_url (3:1).
-- NULL = this banner has no mobile image, phones show image_url as before.
-- No RLS or GRANT change is needed: banner_ads policies are row-level and anon/authenticated
-- already have table-level SELECT, so the new column is covered automatically.
--
-- RUN THIS BEFORE deploying the code: the home and category banner queries select this column,
-- so banners would fail to load until it exists.
ALTER TABLE public.banner_ads ADD COLUMN IF NOT EXISTS mobile_image_url text;
