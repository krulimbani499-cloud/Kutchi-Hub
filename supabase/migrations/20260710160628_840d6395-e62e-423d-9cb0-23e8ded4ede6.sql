
CREATE TABLE public.business_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric,
  discount_price numeric,
  category text,
  stock integer,
  in_stock boolean NOT NULL DEFAULT true,
  image_urls text[] NOT NULL DEFAULT '{}',
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX business_products_business_id_idx ON public.business_products(business_id);

GRANT SELECT ON public.business_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_products TO authenticated;
GRANT ALL ON public.business_products TO service_role;

ALTER TABLE public.business_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Products are public" ON public.business_products
  FOR SELECT USING (true);

CREATE POLICY "Owner can manage products" ON public.business_products
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_products.business_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_products.business_id AND b.owner_id = auth.uid()));

CREATE POLICY "Admin can manage products" ON public.business_products
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_business_products_updated_at
  BEFORE UPDATE ON public.business_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
