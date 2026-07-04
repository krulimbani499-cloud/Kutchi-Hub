import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { getCategories } from "@/lib/businesses.functions";
import { BusinessForm } from "@/components/business/BusinessForm";
import { CheckCircle2, Users, Smile, Store } from "lucide-react";

const categoriesQueryOptions = queryOptions({
  queryKey: ["categories"],
  queryFn: () => getCategories(),
});

export const Route = createFileRoute("/_authenticated/business/new")({
  head: () => ({
    meta: [
      { title: "Add Business — Kutchi Hub" },
      { name: "description", content: "Add your business to Kutchi Hub directory." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(categoriesQueryOptions),
  component: NewBusinessPage,
});

function NewBusinessPage() {
  const { data: categories } = useSuspenseQuery(categoriesQueryOptions);

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-b from-orange-50/60 to-white">
        <div className="mx-auto max-w-7xl px-4 py-10 md:py-14">
          <p className="mb-3 text-sm text-muted-foreground">
            <span className="hover:underline">Home</span>
            <span className="mx-2">›</span>
            <span>Free Business Listing</span>
          </p>
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div>
              <h1 className="text-4xl font-extrabold leading-tight text-foreground md:text-5xl">
                List Your Business <span className="text-[#ff6a00]">for FREE</span>
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
            </div>

            {/* Right side stats card */}
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

      {/* Form */}
      <section className="mx-auto max-w-3xl px-4 py-10">
        <h2 className="mb-2 text-2xl font-bold text-foreground">Add your business details</h2>
        <p className="mb-6 text-muted-foreground">
          Fill in the details below. Your listing will be reviewed by our admin before going live.
        </p>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <BusinessForm categories={categories} />
        </div>
      </section>
    </div>
  );
}
