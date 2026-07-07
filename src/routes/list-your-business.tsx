import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Users, Smile, Store, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/list-your-business")({
  head: () => ({
    meta: [
      { title: "List Your Business — Kutchi Hub" },
      {
        name: "description",
        content:
          "List your Kutchi business on Kutchi Hub only in ₹500 and get discovered by thousands of local customers.",
      },
      { property: "og:title", content: "List Your Business — Kutchi Hub" },
      {
        property: "og:description",
        content:
          "Get discovered by thousands of Kutchi customers. List your business on Kutchi Hub for just ₹500.",
      },
    ],
  }),
  component: ListYourBusinessPage,
});

function ListYourBusinessPage() {
  const { user, isLoading } = useAuth();

  return (
    <div className="bg-white">
      <section className="border-b border-border bg-gradient-to-b from-orange-50/60 to-white">
        <div className="mx-auto max-w-7xl px-4 py-10 md:py-14">
          <p className="mb-3 text-sm text-muted-foreground">
            <Link to="/" className="hover:underline">
              Home
            </Link>
            <span className="mx-2">›</span>
            <span>List Your Business</span>
          </p>
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div>
              <h1 className="text-4xl font-extrabold leading-tight text-foreground md:text-5xl">
                List Your Business <span className="text-[#ff6a00]">Only in ₹500</span>
              </h1>
              <p className="mt-3 text-lg text-muted-foreground">
                with Kutchi Hub — Your Local Kutchi Search Engine
              </p>

              <div className="mt-6 rounded-xl border border-[#ff6a00]/40 bg-orange-50/70 px-4 py-3 text-sm font-medium text-foreground">
                🔥 1,200+ Kutchi businesses listed in the last 30 days
              </div>

              <ul className="mt-6 space-y-3">
                {[
                  "Get Discovered & Create Your Online Business",
                  "Respond to Customer Reviews & Questions",
                  "Showcase Your Products & Service Offerings",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-foreground">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                {isLoading ? null : user ? (
                  <Button
                    size="lg"
                    className="rounded-full bg-[#ff6a00] text-white hover:bg-[#e65a00]"
                    asChild
                  >
                    <Link to="/business/new">
                      Get Started <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    className="rounded-full bg-[#ff6a00] text-white hover:bg-[#e65a00]"
                    asChild
                  >
                    <Link to="/auth">
                      Sign in to List Your Business <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </div>
            </div>

            <div className="relative">
              <div className="grid gap-4">
                <div className="flex items-center gap-4 rounded-2xl bg-green-100/70 p-5 shadow-sm">
                  <div className="rounded-full bg-white p-3">
                    <Users className="h-6 w-6 text-green-700" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground">50K+</div>
                    <div className="text-sm text-muted-foreground">Buyers</div>
                  </div>
                </div>
                <div className="ml-8 flex items-center gap-4 rounded-2xl bg-pink-100/70 p-5 shadow-sm">
                  <div className="rounded-full bg-white p-3">
                    <Smile className="h-6 w-6 text-pink-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground">10K+</div>
                    <div className="text-sm text-muted-foreground">Happy Customers</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 rounded-2xl bg-blue-100/70 p-5 shadow-sm">
                  <div className="rounded-full bg-white p-3">
                    <Store className="h-6 w-6 text-blue-700" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground">5K+</div>
                    <div className="text-sm text-muted-foreground">Businesses Listed</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}