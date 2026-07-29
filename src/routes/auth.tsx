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
  component: AuthPage,
});

function AuthPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <AuthForms />
    </div>
  );
}
