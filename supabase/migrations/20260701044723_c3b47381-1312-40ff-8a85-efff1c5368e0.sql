CREATE TYPE public.app_role AS ENUM ('user', 'business_owner', 'admin');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_user_id_key UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own profile"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Public can view profiles"
  ON public.profiles FOR SELECT
  TO anon
  USING (true);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon;

CREATE OR REPLACE FUNCTION public.create_profile_for_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_profile_for_user();

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  icon text,
  color text,
  parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.categories TO anon;
GRANT SELECT ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories are public"
  ON public.categories FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Authenticated users can view categories"
  ON public.categories FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  description text,
  address text,
  city text,
  state text,
  pincode text,
  phone text,
  email text,
  website text,
  latitude numeric(10,8),
  longitude numeric(11,8),
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'published',
  verified boolean NOT NULL DEFAULT false,
  hours jsonb,
  featured_image text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT businesses_slug_city_key UNIQUE (slug, city)
);

CREATE INDEX idx_businesses_category ON public.businesses(category_id);
CREATE INDEX idx_businesses_city ON public.businesses(city);
CREATE INDEX idx_businesses_status ON public.businesses(status);
CREATE INDEX idx_businesses_search ON public.businesses USING gin(to_tsvector('english', coalesce(name,'') || ' ' || coalesce(description,'') || ' ' || coalesce(city,'')));

GRANT SELECT ON public.businesses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.businesses TO authenticated;
GRANT ALL ON public.businesses TO service_role;

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published businesses are public"
  ON public.businesses FOR SELECT
  TO anon
  USING (status = 'published');

CREATE POLICY "Authenticated users can view published businesses"
  ON public.businesses FOR SELECT
  TO authenticated
  USING (status = 'published' OR owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can create businesses"
  ON public.businesses FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update their own businesses"
  ON public.businesses FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners can delete their own businesses"
  ON public.businesses FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.business_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review text,
  helpful_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_reviews_business_user_key UNIQUE (business_id, user_id)
);

CREATE INDEX idx_reviews_business ON public.business_reviews(business_id);

GRANT SELECT ON public.business_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_reviews TO authenticated;
GRANT ALL ON public.business_reviews TO service_role;

ALTER TABLE public.business_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviews are public"
  ON public.business_reviews FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Authenticated users can view reviews"
  ON public.business_reviews FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create reviews"
  ON public.business_reviews FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own reviews"
  ON public.business_reviews FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete their own reviews"
  ON public.business_reviews FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.business_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  url text NOT NULL,
  caption text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.business_photos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_photos TO authenticated;
GRANT ALL ON public.business_photos TO service_role;

ALTER TABLE public.business_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Photos are public"
  ON public.business_photos FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Authenticated users can view photos"
  ON public.business_photos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Business owners can manage photos"
  ON public.business_photos FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_photos.business_id
      AND (b.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_photos.business_id
      AND (b.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE TABLE public.business_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_claims_business_user_key UNIQUE (business_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_claims TO authenticated;
GRANT ALL ON public.business_claims TO service_role;

ALTER TABLE public.business_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own claims"
  ON public.business_claims FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'business_owner'));

CREATE POLICY "Users can create claims"
  ON public.business_claims FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update claims"
  ON public.business_claims FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_businesses_updated_at
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON public.business_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_claims_updated_at
  BEFORE UPDATE ON public.business_claims
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.categories (name, slug, icon, color, display_order) VALUES
  ('Restaurants', 'restaurants', 'utensils', '#f97316', 1),
  ('Hotels', 'hotels', 'bed', '#3b82f6', 2),
  ('Hospitals', 'hospitals', 'stethoscope', '#ef4444', 3),
  ('Schools', 'schools', 'graduation-cap', '#8b5cf6', 4),
  ('Grocery', 'grocery', 'shopping-cart', '#22c55e', 5),
  ('Salons', 'salons', 'scissors', '#ec4899', 6),
  ('Banks', 'banks', 'landmark', '#06b6d4', 7),
  ('Automobile', 'automobile', 'car', '#f59e0b', 8),
  ('Real Estate', 'real-estate', 'home', '#14b8a6', 9),
  ('Gyms', 'gyms', 'dumbbell', '#6366f1', 10)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.businesses (name, slug, category_id, description, address, city, state, pincode, phone, email, website, latitude, longitude, status, verified, hours, featured_image)
SELECT
  'Tasty Corner Restaurant',
  'tasty-corner-restaurant',
  (SELECT id FROM public.categories WHERE slug = 'restaurants'),
  'A cozy family restaurant serving North Indian and Chinese cuisine.',
  '12 Main Street',
  'Mumbai',
  'Maharashtra',
  '400001',
  '+91 98765 43210',
  'info@tastycorner.example',
  'https://tastycorner.example',
  19.076090,
  72.877426,
  'published',
  true,
  '{"mon":"10:00-22:00","tue":"10:00-22:00","wed":"10:00-22:00","thu":"10:00-22:00","fri":"10:00-22:00","sat":"10:00-23:00","sun":"10:00-23:00"}'::jsonb,
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80'
WHERE NOT EXISTS (SELECT 1 FROM public.businesses WHERE slug = 'tasty-corner-restaurant' AND city = 'Mumbai');

INSERT INTO public.businesses (name, slug, category_id, description, address, city, state, pincode, phone, email, website, latitude, longitude, status, verified, hours, featured_image)
SELECT
  'City Care Hospital',
  'city-care-hospital',
  (SELECT id FROM public.categories WHERE slug = 'hospitals'),
  'Multi-speciality hospital with 24/7 emergency services.',
  '45 Hospital Road',
  'Mumbai',
  'Maharashtra',
  '400002',
  '+91 98765 12345',
  'care@citycare.example',
  'https://citycare.example',
  19.082522,
  72.886588,
  'published',
  true,
  '{"mon":"00:00-23:59","tue":"00:00-23:59","wed":"00:00-23:59","thu":"00:00-23:59","fri":"00:00-23:59","sat":"00:00-23:59","sun":"00:00-23:59"}'::jsonb,
  'https://images.unsplash.com/photo-1587351021759-3e566b72af30?w=800&q=80'
WHERE NOT EXISTS (SELECT 1 FROM public.businesses WHERE slug = 'city-care-hospital' AND city = 'Mumbai');

INSERT INTO public.businesses (name, slug, category_id, description, address, city, state, pincode, phone, email, website, latitude, longitude, status, verified, hours, featured_image)
SELECT
  'Green Leaf Grocery',
  'green-leaf-grocery',
  (SELECT id FROM public.categories WHERE slug = 'grocery'),
  'Fresh fruits, vegetables, and daily essentials delivered to your home.',
  '88 Market Lane',
  'Delhi',
  'Delhi',
  '110001',
  '+91 98765 67890',
  'hello@greenleaf.example',
  'https://greenleaf.example',
  28.613939,
  77.209023,
  'published',
  false,
  '{"mon":"07:00-21:00","tue":"07:00-21:00","wed":"07:00-21:00","thu":"07:00-21:00","fri":"07:00-21:00","sat":"07:00-21:00","sun":"08:00-20:00"}'::jsonb,
  'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80'
WHERE NOT EXISTS (SELECT 1 FROM public.businesses WHERE slug = 'green-leaf-grocery' AND city = 'Delhi');
