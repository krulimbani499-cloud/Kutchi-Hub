import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { getCategories, getListingFlow } from "@/lib/businesses.functions";
import { BusinessForm } from "@/components/business/BusinessForm";
import { QuickListingForm } from "@/components/business/QuickListingForm";
import { CheckCircle2 } from "lucide-react";

const categoriesQueryOptions = queryOptions({
  queryKey: ["categories"],
  queryFn: () => getCategories(),
});

const listingFlowQueryOptions = queryOptions({
  queryKey: ["listing-flow"],
  queryFn: () => getListingFlow(),
});

export const Route = createFileRoute("/_authenticated/business/new")({
  head: () => ({
    meta: [
      { title: "Add Business — Kutchi Hub" },
      { name: "description", content: "Add your business to Kutchi Hub directory." },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(categoriesQueryOptions),
      context.queryClient.ensureQueryData(listingFlowQueryOptions),
    ]);
  },
  component: NewBusinessPage,
});

function NewBusinessPage() {
  const { data: categories } = useSuspenseQuery(categoriesQueryOptions);
  const { data: flow } = useSuspenseQuery(listingFlowQueryOptions);
  // Owners get the 4-field quick form once the database is ready; admins (and everyone, until then) get the full form.
  const quick = !flow.isAdmin && flow.quickReady;

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-b from-orange-50/60 to-white">
        <div className="mx-auto max-w-7xl px-4 py-10 md:py-14">
          <p className="mb-3 text-sm text-muted-foreground">
            <span className="hover:underline">Home</span>
            <span className="mx-2">›</span>
            <span>Business Listing</span>
          </p>
          <div className="max-w-2xl">
            <h1 className="text-4xl font-extrabold leading-tight text-foreground md:text-5xl">
              List Your Business on Kutchi Hub
            </h1>
            <p className="mt-3 text-lg text-muted-foreground">
              with Kutchi Hub — Your Local Kutchi Search Engine
            </p>
            <p className="mt-2 text-sm text-muted-foreground" data-ios-hide>
              Check out our{" "}
              <Link to="/pricing" className="font-medium text-[#ff6a00] hover:underline">
                plans & pricing
              </Link>{" "}
              to see what's included.
            </p>

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
        </div>
      </section>

      {/* Form */}
      <section className="mx-auto max-w-3xl px-4 py-10">
        {quick ? (
          <>
            <h2 className="mb-2 text-2xl font-bold text-foreground">Tell us about your business</h2>
            <p className="mb-6 text-muted-foreground">
              Just 4 details. Our team will call you within 24 hours to activate your listing.
            </p>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <QuickListingForm categories={categories} />
            </div>
          </>
        ) : (
          <>
            <h2 className="mb-2 text-2xl font-bold text-foreground">Add your business details</h2>
            <p className="mb-6 text-muted-foreground">
              Fill in the details below. Your listing will be reviewed by our admin before going live.
            </p>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <BusinessForm categories={categories} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
