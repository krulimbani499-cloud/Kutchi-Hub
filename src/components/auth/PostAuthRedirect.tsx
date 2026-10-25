import { useEffect } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { takeRememberedRedirect } from "@/lib/redirect";

/** After a sign-up e-mail link or a Google / Apple sign-in brings the person back to the home page, continue to where they were going. */
export function PostAuthRedirect() {
  const { user } = useAuth();
  const router = useRouter();
  const path = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    if (!user || path !== "/") return;
    const target = takeRememberedRedirect();
    if (target) router.history.replace(target);
  }, [user, path, router]);
  return null;
}
