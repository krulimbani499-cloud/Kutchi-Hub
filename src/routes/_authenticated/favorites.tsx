import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { BusinessCard } from "@/components/business/BusinessCard";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/favorites")({
  head: () => ({
    meta: [
      { title: "My Favorites — Kutchi Hub" },
      { name: "description", content: "Businesses you've saved to your favorites list." },
    ],
  }),
  component: FavoritesPage,
});

type FavoriteRow = {
  business_id: string;
  businesses: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    address: string | null;
    city: string | null;
    phone: string | null;
    verified: boolean;
    featured_image: string | null;
    categories: { id: string; name: string; slug: string; color: string | null } | null;
  } | null;
};

function FavoritesPage() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["my-favorites", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [] as FavoriteRow[];
      const { data, error } = await supabase
        .from("business_favorites")
        .select(
          "business_id, businesses:business_id(id, name, slug, description, address, city, phone, verified, featured_image, categories:category_id(id, name, slug, color))",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FavoriteRow[];
    },
  });

  const businesses = (data ?? []).map((r) => r.businesses).filter((b): b is NonNullable<FavoriteRow["businesses"]> => !!b);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center gap-2">
        <Heart className="h-6 w-6 fill-[#ff2d55] text-[#ff2d55]" />
        <h1 className="text-2xl font-bold text-foreground">My Favorites</h1>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading your favorites…</p>
      ) : businesses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <Heart className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">No favorites yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap the heart on any business to save it here for later.
          </p>
          <Button className="mt-4 bg-primary text-primary-foreground" asChild>
            <Link to="/">Browse businesses</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {businesses.map((b) => (
            <BusinessCard key={b.id} business={b} />
          ))}
        </div>
      )}
    </div>
  );
}