import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Outlet } from "@tanstack/react-router";
import { safeRedirectPath } from "@/lib/redirect";
import { SHOW_SAVED } from "@/lib/features";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  head: () => ({
    meta: [{ name: "robots", content: "noindex,follow" }],
  }),
  beforeLoad: async ({ location }) => {
    // Saved businesses are switched off (features.ts): the page does not exist for now, signed in or not.
    if (!SHOW_SAVED && /^\/favorites(\/|$)/.test(location.pathname)) throw redirect({ to: "/all-business" });
    // getSession() reads the stored session on the device (and refreshes an expired token): no network round trip on every
    // page change. getUser() asked the Supabase auth server each time, which cost 100-300 ms per navigation on a phone.
    // This guard only decides who is sent to the sign-in page; the server functions and the database rules (RLS)
    // verify the token on every request.
    const { data, error } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (error || !user) {
      // Come back to this page after signing in (e.g. /business/new), not to the home page.
      throw redirect({ to: "/auth", search: { redirect: safeRedirectPath(location.pathname + location.searchStr) } });
    }
    return { user };
  },
  component: () => <Outlet />,
});
