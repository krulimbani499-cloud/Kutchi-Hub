import { createFileRoute } from "@tanstack/react-router";
import { AuthForms } from "@/components/auth/AuthForms";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In — NearMe" },
      { name: "description", content: "Sign in or create an account on NearMe to manage business listings and write reviews." },
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
