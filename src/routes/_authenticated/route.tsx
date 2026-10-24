import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  head: () => ({
    meta: [{ name: "robots", content: "noindex,follow" }],
  }),
  beforeLoad: async () => {
    // getSession() reads the stored session on the device (and refreshes an expired token): no network round trip on every
    // page change. getUser() asked the Supabase auth server each time, which cost 100-300 ms per navigation on a phone.
    // This guard only decides who is sent to the sign-in page; the server functions and the database rules (RLS)
    // verify the token on every request.
    const { data, error } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (error || !user) {
      throw redirect({ to: "/auth" });
    }
    return { user };
  },
  component: () => <Outlet />,
});
