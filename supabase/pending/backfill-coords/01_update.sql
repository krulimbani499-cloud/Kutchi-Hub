-- Backfill of businesses.latitude / longitude (generated 2026-10-14 by scripts/backfill-coords.mjs). NOT YET RUN.
-- 36 businesses. Each UPDATE only touches a row whose latitude is still NULL, so it never overwrites a value.
-- Source: url = coordinates in the saved Maps link | short-link = in the link it redirects to |
--         short-link-place = the place name + address the short link points at, geocoded | geocode = saved address + city, geocoded.
-- "approximate" = Google found only the street / area, not the exact building.
-- Run in the Supabase SQL editor (no auth.uid(), so the admin-column guard trigger does not apply). Revert: 02_revert.sql.

BEGIN;

-- Bluenova Tech Private Limited (Ahmedabad) — source: geocode, approximate, 4 km from city centre
UPDATE public.businesses SET latitude = 22.997615, longitude = 72.549150 WHERE id = 'c7d4e892-2e13-42e4-b931-1d575654bc3d' AND latitude IS NULL;

-- K P Electric & Hardware (Ahmedabad) — source: short-link-place, approximate, 13 km from city centre
UPDATE public.businesses SET latitude = 23.086339, longitude = 72.683303 WHERE id = '3bd65f49-a994-495d-ab3f-24ea166d7519' AND latitude IS NULL;

-- KD collection & Matching Center (Ahmedabad) — source: short-link-place, 12 km from city centre
UPDATE public.businesses SET latitude = 23.066972, longitude = 72.676531 WHERE id = '539ec3cf-898a-4e0a-8ba2-d820bd2c3f7f' AND latitude IS NULL;

-- LABH INDUSTRIES (Ahmedabad) — source: short-link-place, approximate, 9 km from city centre
UPDATE public.businesses SET latitude = 23.069524, longitude = 72.645631 WHERE id = '33b655e9-ba67-447b-9a20-f5d1577682e4' AND latitude IS NULL;

-- Last Option Men's Wear (Ahmedabad) — source: short-link-place, 10 km from city centre
UPDATE public.businesses SET latitude = 23.074380, longitude = 72.654484 WHERE id = '1d823130-8bba-4389-b040-876c74ece44d' AND latitude IS NULL;

-- My Little Genius Pre School (Ahmedabad) — source: short-link, 13 km from city centre
UPDATE public.businesses SET latitude = 23.086200, longitude = 72.683366 WHERE id = '967bdd08-f3d2-42d9-9ecd-dfb2e42eb3d1' AND latitude IS NULL;

-- R.N PATEL. &CO. (Ahmedabad) — source: geocode, 10 km from city centre
UPDATE public.businesses SET latitude = 23.077855, longitude = 72.654015 WHERE id = '3a69824b-2565-4679-8cfa-4e35bf080cc9' AND latitude IS NULL;

-- Bike Point (Dahegam) — source: short-link-place, approximate, 0 km from city centre
UPDATE public.businesses SET latitude = 23.164982, longitude = 72.811782 WHERE id = '6771818a-335b-4909-b935-f461b22630f9' AND latitude IS NULL;

-- Hero Bike Point (Dahegam) — source: short-link-place, 0 km from city centre
UPDATE public.businesses SET latitude = 23.161214, longitude = 72.806720 WHERE id = '0dfc1728-5711-4f88-934a-403f821bb5cd' AND latitude IS NULL;

-- Mahaa Decorative Door & CNC Work (Dahegam) — source: short-link, 13 km from city centre
UPDATE public.businesses SET latitude = 23.099223, longitude = 72.701899 WHERE id = 'c60abc6d-38e7-4351-ad79-c094c15e1408' AND latitude IS NULL;

-- ODHAVRAM HARDWARE & PLYWOOD & SANITARY (Dahegam) — source: short-link-place, 1 km from city centre
UPDATE public.businesses SET latitude = 23.158192, longitude = 72.801342 WHERE id = '9ae1483a-13ad-44f2-ace2-b07d85c8f59a' AND latitude IS NULL;

-- Shree Uma Auto Parts (Dahegam) — source: geocode, approximate, 0 km from city centre
UPDATE public.businesses SET latitude = 23.163720, longitude = 72.810245 WHERE id = 'f1c171ec-cf6f-47ef-85b7-ac9c35a0a40b' AND latitude IS NULL;

-- Umiya Battery & Auto Electric (Dahegam) — source: short-link-place, approximate, 1 km from city centre
UPDATE public.businesses SET latitude = 23.157637, longitude = 72.800340 WHERE id = '1fc7ab2c-0175-4f52-9bfa-d5dd98f59f36' AND latitude IS NULL;

-- Vinayak Alignment (Dahegam) — source: geocode, approximate, 1 km from city centre
UPDATE public.businesses SET latitude = 23.166498, longitude = 72.814491 WHERE id = 'e3f0a92a-5043-452f-9602-84087ba81aa2' AND latitude IS NULL;

-- Vinayak Technocast Industries Pvt Ltd (Dahegam) — source: short-link-place, 0 km from city centre
UPDATE public.businesses SET latitude = 23.163178, longitude = 72.808842 WHERE id = '279e9f1a-50bf-470c-8b3e-accc78763df0' AND latitude IS NULL;

-- Vinayak Tiles (Dahegam) — source: short-link-place, 0 km from city centre
UPDATE public.businesses SET latitude = 23.163178, longitude = 72.808842 WHERE id = '0592c13c-e855-4289-98eb-f7bb7ceb6109' AND latitude IS NULL;

-- YUG HONDA (Dahegam) — source: short-link-place, 0 km from city centre
UPDATE public.businesses SET latitude = 23.161214, longitude = 72.806720 WHERE id = 'b8d974f6-d08a-4977-99ed-aaa109f280af' AND latitude IS NULL;

-- PATEL AUTO SERVICE (Dhansura) — source: short-link-place, 1 km from city centre
UPDATE public.businesses SET latitude = 23.344784, longitude = 73.208151 WHERE id = '9fa521ee-10a0-4496-ada8-f6fa3aa1a501' AND latitude IS NULL;

-- Aditya infra (Himatnagar) — source: short-link-place, 2 km from city centre
UPDATE public.businesses SET latitude = 23.582532, longitude = 72.968584 WHERE id = '26fada81-47cc-4db2-9979-b3d98d53fa93' AND latitude IS NULL;

-- Deep Gynec Hospital. (Himatnagar) — source: short-link-place, 2 km from city centre
UPDATE public.businesses SET latitude = 23.580426, longitude = 72.973533 WHERE id = 'a62c2bcf-d2e7-4854-8f2c-f4f72f9ed150' AND latitude IS NULL;

-- Gurukrupa Marble And Steel (Himatnagar) — source: geocode, approximate, 1 km from city centre
UPDATE public.businesses SET latitude = 23.591830, longitude = 72.966243 WHERE id = 'c8589178-d8fc-4ddb-a936-c12bb8c44dc9' AND latitude IS NULL;

-- Param Pathology Laboratory (Himatnagar) — source: short-link-place, approximate, 1 km from city centre
UPDATE public.businesses SET latitude = 23.588148, longitude = 72.953438 WHERE id = '9f62a1d8-e3f9-4084-aba2-578f7625d3c2' AND latitude IS NULL;

-- Prabhat Timber & Hardware Store (Himatnagar) — source: short-link-place, approximate, 2 km from city centre
UPDATE public.businesses SET latitude = 23.613148, longitude = 72.963887 WHERE id = '10e8e26c-1d55-4303-88ce-12067aeb01f0' AND latitude IS NULL;

-- Prayag Enterprise (Himatnagar) — source: short-link-place, 2 km from city centre
UPDATE public.businesses SET latitude = 23.582532, longitude = 72.968584 WHERE id = '22c27c6e-11a1-4266-bd9d-53f58f12bffd' AND latitude IS NULL;

-- RAMA GALLERY (Himatnagar) — source: url, 1 km from city centre
UPDATE public.businesses SET latitude = 23.592960, longitude = 72.974336 WHERE id = '4f4c0954-f313-4f50-8c0b-7e61da752ef5' AND latitude IS NULL;

-- Shree Radhe Developers (Himatnagar) — source: short-link-place, 1 km from city centre
UPDATE public.businesses SET latitude = 23.583848, longitude = 72.965746 WHERE id = '405daedc-d02a-4dd9-8915-700ee0b321b8' AND latitude IS NULL;

-- JALARAM CNC ART & CRAFT (HIMATNAGAR) — source: short-link-place, 4 km from city centre
UPDATE public.businesses SET latitude = 23.563345, longitude = 72.986527 WHERE id = '60617703-504a-4ed1-afad-dd749d7a4553' AND latitude IS NULL;

-- PATEL SALES (HIMATNAGAR) — source: short-link-place, 4 km from city centre
UPDATE public.businesses SET latitude = 23.563419, longitude = 72.986367 WHERE id = 'a079b515-e53f-46ae-a06a-6a836b14c329' AND latitude IS NULL;

-- Pavan TVS (Kapadvanj) — source: short-link-place, 1 km from city centre
UPDATE public.businesses SET latitude = 23.015186, longitude = 73.058152 WHERE id = '093fe35f-9260-483c-9d8a-4c9bfb5dafaa' AND latitude IS NULL;

-- Vinayak Tractors (Kapadvanj) — source: short-link-place, approximate, 2 km from city centre
UPDATE public.businesses SET latitude = 23.011031, longitude = 73.054399 WHERE id = '1c145538-7a30-4adc-9b50-84aeca3cada1' AND latitude IS NULL;

-- ECO ENTERPRISE (Prantij) — source: short-link-place, 4 km from city centre
UPDATE public.businesses SET latitude = 23.408111, longitude = 72.827455 WHERE id = '5d875d68-2a90-478d-b168-4a0ffcc38138' AND latitude IS NULL;

-- GURUKRUPA SPARE PARTS & BIKE SERVICE (Rakhiyal) — source: short-link
UPDATE public.businesses SET latitude = 23.254403, longitude = 72.902807 WHERE id = 'e41e5291-d97c-472e-b19d-57c7d1f3a477' AND latitude IS NULL;

-- CRYSTAL DOOR INDUSTRIES (Sangli) — source: short-link-place, 5 km from city centre
UPDATE public.businesses SET latitude = 16.896364, longitude = 74.591136 WHERE id = '98de6b22-35fe-4dca-bc69-4019b2899e96' AND latitude IS NULL;

-- Jalaram Agri Sales (Vadagam (Aravalli)) — source: short-link-place, 0 km from city centre
UPDATE public.businesses SET latitude = 23.325826, longitude = 73.135189 WHERE id = '7a8e2ff3-a7fc-4573-bc5d-afb38fa30c66' AND latitude IS NULL;

-- JALARAM SECURITY SYSTEM (Vadagam (Aravalli)) — source: short-link-place, approximate, 0 km from city centre
UPDATE public.businesses SET latitude = 23.326051, longitude = 73.137355 WHERE id = '891af2a6-badb-48e1-a7da-3d0e65e74647' AND latitude IS NULL;

-- Vishwas sales (Vadagam (Aravalli)) — source: short-link-place, 0 km from city centre
UPDATE public.businesses SET latitude = 23.325516, longitude = 73.134899 WHERE id = '49f5c18f-3fa4-4d35-80a9-cd1605da3bca' AND latitude IS NULL;

COMMIT;
