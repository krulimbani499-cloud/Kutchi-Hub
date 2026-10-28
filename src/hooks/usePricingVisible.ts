import { SHOW_PUBLIC_PRICING } from "@/lib/features";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useIsIosApp } from "@/hooks/useIsIosApp";

/**
 * May this person see plan prices, plan cards and Upgrade / View plans / Buy buttons?
 *  - iOS app: never (Apple 3.1.1).
 *  - everyone else: only admins, until SHOW_PUBLIC_PRICING (src/lib/features.ts) is switched on.
 * It is false on the server and on the first render, so prices never flash for the public.
 */
export function usePricingVisible(): boolean {
  const isIosApp = useIsIosApp();
  const isAdmin = useIsAdmin(!SHOW_PUBLIC_PRICING && !isIosApp);
  if (isIosApp) return false;
  return SHOW_PUBLIC_PRICING || isAdmin;
}
