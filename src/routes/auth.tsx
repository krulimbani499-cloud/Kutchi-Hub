import { createFileRoute } from "@tanstack/react-router";
import { AuthForms } from "@/components/auth/AuthForms";
import { safeRedirectPath } from "@/lib/redirect";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In — Kutchi Hub" },
      { name: "description", content: "Sign in or create an account on Kutchi Hub to manage business listings and write reviews." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  // `mode` picks the starting tab (used by the Android welcome screen); `ref` is kept so the
  // referral link (?ref=CODE) read by AuthForms is never stripped from the URL.
  // Both are optional, so existing <Link to="/auth"> usages keep working without a search prop.
  // `redirect` is the page to open after signing in (an internal path only, see safeRedirectPath). It is always returned, even when
  // empty: the router merges the raw URL params under what is returned here, so an unsafe value would otherwise slip through.
  validateSearch: (s: Record<string, unknown>): { mode?: "signin" | "signup"; ref?: string; redirect?: string } => ({
    ...(s.mode === "signup" || s.mode === "signin" ? { mode: s.mode } : {}),
    ...(typeof s.ref === "string" ? { ref: s.ref } : {}),
    redirect: safeRedirectPath(s.redirect),
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode, redirect } = Route.useSearch();
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <AuthForms initialMode={mode} redirectTo={redirect} />
    </div>
  );
}
