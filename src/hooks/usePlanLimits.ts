import { useQuery } from "@tanstack/react-query";
import { getPlanLimits } from "@/lib/plans.functions";

/**
 * What the business's plan allows (photos / products / services). `null` = not known (still loading, or it could not be
 * read): callers then keep the behaviour from before plan limits were shown. -1 = unlimited.
 */
export function usePlanLimits(businessId: string | null | undefined) {
  const { data } = useQuery({
    queryKey: ["plan-limits", businessId],
    queryFn: () => getPlanLimits({ data: { businessId: businessId as string } }),
    enabled: !!businessId,
    staleTime: 60_000,
  });
  return {
    photos: data?.photos ?? null,
    products: data?.products ?? null,
    services: data?.services ?? null,
    planName: data?.planName ?? null,
  };
}
