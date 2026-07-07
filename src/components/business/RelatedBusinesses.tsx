import { useQuery } from "@tanstack/react-query";
import { getRelatedBusinesses } from "@/lib/businesses.functions";
import { BusinessCard } from "./BusinessCard";

interface Props {
  businessId: string;
  categoryId: string | null;
  city: string | null;
}

export function RelatedBusinesses({ businessId, categoryId, city }: Props) {
  const { data = [] } = useQuery({
    queryKey: ["related-businesses", businessId, categoryId, city],
    queryFn: () => getRelatedBusinesses({ data: { businessId, categoryId, city } }),
  });

  if (!data.length) return null;

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-4 text-lg font-semibold text-foreground">Similar businesses</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.slice(0, 6).map((b) => (
          <BusinessCard key={b.id} business={b} />
        ))}
      </div>
    </section>
  );
}