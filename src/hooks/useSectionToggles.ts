import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const sectionTogglesKey = (businessId: string) => ["section-toggles", businessId] as const;

/**
 * The saved "Show Services / Products on my profile" switches of one business (used by the managers to say "Hidden from your
 * public profile"). undefined = not known yet, or the database update that adds the columns is not applied: callers then say nothing.
 */
export function useSectionToggles(businessId: string): { show_services?: boolean; show_products?: boolean } | undefined {
  const { data } = useQuery({
    queryKey: sectionTogglesKey(businessId),
    staleTime: 60_000,
    queryFn: async () => {
      const { data: row, error } = await supabase
        .from("businesses")
        .select("show_services, show_products")
        .eq("id", businessId)
        .maybeSingle();
      if (error || !row) return null; // missing columns (SQL not applied) or no access: no note
      return { show_services: row.show_services, show_products: row.show_products };
    },
  });
  return data ?? undefined;
}
