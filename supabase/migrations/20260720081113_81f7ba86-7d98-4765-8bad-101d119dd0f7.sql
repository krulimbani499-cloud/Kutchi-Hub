UPDATE public.businesses SET city = 'Kapadvanj' WHERE city ILIKE 'kapadwanj';
UPDATE public.banner_ads SET title = REPLACE(title, 'Kapadwanj', 'Kapadvanj') WHERE title ILIKE '%kapadwanj%';