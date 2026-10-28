import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const KEY = ["is-admin"] as const;

/**
 * Is the signed-in person an admin? One shared, cached answer for every component that asks (the same has_role check the header
 * uses). The server and the first render say false; the answer arrives after sign-in is known. This only decides what is
 * shown: admin actions are still checked by the server and the database.
 */
export function useIsAdmin(enabled = true): boolean {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: KEY,
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      // getSession reads the stored session on the device (no network round trip).
      const { data: s } = await supabase.auth.getSession();
      const id = s.session?.user.id;
      if (!id) return false;
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: id, _role: "admin" });
      return !!isAdmin;
    },
  });
  useEffect(() => {
    if (!enabled) return;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      // Only a real change of who is signed in matters (not every token refresh).
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void queryClient.invalidateQueries({ queryKey: KEY });
    });
    return () => sub.subscription.unsubscribe();
  }, [enabled, queryClient]);
  return data === true;
}
