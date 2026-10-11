import { createFileRoute } from "@tanstack/react-router";
import { AuthForms } from "@/components/auth/AuthForms";

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
  validateSearch: (s: Record<string, unknown>): { mode?: "signin" | "signup"; ref?: string } => ({
    ...(s.mode === "signup" || s.mode === "signin" ? { mode: s.mode } : {}),
    ...(typeof s.ref === "string" ? { ref: s.ref } : {}),
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <AuthForms initialMode={mode} />
    </div>
  );
}
