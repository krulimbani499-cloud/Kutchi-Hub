-- Reverts 01_update.sql: sets latitude / longitude back to NULL for exactly the businesses it filled in.
-- (Rows that already had coordinates before are not in this list.)

BEGIN;

UPDATE public.businesses SET latitude = NULL, longitude = NULL WHERE id IN (
  'c7d4e892-2e13-42e4-b931-1d575654bc3d' -- Bluenova Tech Private Limited (Ahmedabad),
  '3bd65f49-a994-495d-ab3f-24ea166d7519' -- K P Electric & Hardware (Ahmedabad),
  '539ec3cf-898a-4e0a-8ba2-d820bd2c3f7f' -- KD collection & Matching Center (Ahmedabad),
  '33b655e9-ba67-447b-9a20-f5d1577682e4' -- LABH INDUSTRIES (Ahmedabad),
  '1d823130-8bba-4389-b040-876c74ece44d' -- Last Option Men's Wear (Ahmedabad),
  '967bdd08-f3d2-42d9-9ecd-dfb2e42eb3d1' -- My Little Genius Pre School (Ahmedabad),
  '3a69824b-2565-4679-8cfa-4e35bf080cc9' -- R.N PATEL. &CO. (Ahmedabad),
  '6771818a-335b-4909-b935-f461b22630f9' -- Bike Point (Dahegam),
  '0dfc1728-5711-4f88-934a-403f821bb5cd' -- Hero Bike Point (Dahegam),
  'c60abc6d-38e7-4351-ad79-c094c15e1408' -- Mahaa Decorative Door & CNC Work (Dahegam),
  '9ae1483a-13ad-44f2-ace2-b07d85c8f59a' -- ODHAVRAM HARDWARE & PLYWOOD & SANITARY (Dahegam),
  'f1c171ec-cf6f-47ef-85b7-ac9c35a0a40b' -- Shree Uma Auto Parts (Dahegam),
  '1fc7ab2c-0175-4f52-9bfa-d5dd98f59f36' -- Umiya Battery & Auto Electric (Dahegam),
  'e3f0a92a-5043-452f-9602-84087ba81aa2' -- Vinayak Alignment (Dahegam),
  '279e9f1a-50bf-470c-8b3e-accc78763df0' -- Vinayak Technocast Industries Pvt Ltd (Dahegam),
  '0592c13c-e855-4289-98eb-f7bb7ceb6109' -- Vinayak Tiles (Dahegam),
  'b8d974f6-d08a-4977-99ed-aaa109f280af' -- YUG HONDA (Dahegam),
  '9fa521ee-10a0-4496-ada8-f6fa3aa1a501' -- PATEL AUTO SERVICE (Dhansura),
  '26fada81-47cc-4db2-9979-b3d98d53fa93' -- Aditya infra (Himatnagar),
  'a62c2bcf-d2e7-4854-8f2c-f4f72f9ed150' -- Deep Gynec Hospital. (Himatnagar),
  'c8589178-d8fc-4ddb-a936-c12bb8c44dc9' -- Gurukrupa Marble And Steel (Himatnagar),
  '9f62a1d8-e3f9-4084-aba2-578f7625d3c2' -- Param Pathology Laboratory (Himatnagar),
  '10e8e26c-1d55-4303-88ce-12067aeb01f0' -- Prabhat Timber & Hardware Store (Himatnagar),
  '22c27c6e-11a1-4266-bd9d-53f58f12bffd' -- Prayag Enterprise (Himatnagar),
  '4f4c0954-f313-4f50-8c0b-7e61da752ef5' -- RAMA GALLERY (Himatnagar),
  '405daedc-d02a-4dd9-8915-700ee0b321b8' -- Shree Radhe Developers (Himatnagar),
  '60617703-504a-4ed1-afad-dd749d7a4553' -- JALARAM CNC ART & CRAFT (HIMATNAGAR),
  'a079b515-e53f-46ae-a06a-6a836b14c329' -- PATEL SALES (HIMATNAGAR),
  '093fe35f-9260-483c-9d8a-4c9bfb5dafaa' -- Pavan TVS (Kapadvanj),
  '1c145538-7a30-4adc-9b50-84aeca3cada1' -- Vinayak Tractors (Kapadvanj),
  '5d875d68-2a90-478d-b168-4a0ffcc38138' -- ECO ENTERPRISE (Prantij),
  'e41e5291-d97c-472e-b19d-57c7d1f3a477' -- GURUKRUPA SPARE PARTS & BIKE SERVICE (Rakhiyal),
  '98de6b22-35fe-4dca-bc69-4019b2899e96' -- CRYSTAL DOOR INDUSTRIES (Sangli),
  '7a8e2ff3-a7fc-4573-bc5d-afb38fa30c66' -- Jalaram Agri Sales (Vadagam (Aravalli)),
  '891af2a6-badb-48e1-a7da-3d0e65e74647' -- JALARAM SECURITY SYSTEM (Vadagam (Aravalli)),
  '49f5c18f-3fa4-4d35-80a9-cd1605da3bca' -- Vishwas sales (Vadagam (Aravalli))
);

COMMIT;
