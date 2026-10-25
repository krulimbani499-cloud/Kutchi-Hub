import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { getCategories, getListingFlow } from "@/lib/businesses.functions";
import { BusinessForm } from "@/components/business/BusinessForm";
import { QuickListingForm } from "@/components/business/QuickListingForm";

const categoriesQueryOptions = queryOptions({
  queryKey: ["categories"],
  queryFn: () => getCategories(),
  // The category list changes a few times a year: keep it for 10 minutes instead of asking again on every visit.
  staleTime: 10 * 60_000,
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
      {/* The form is the first thing on the page: no info / plans section above it. */}
      <section className="mx-auto max-w-3xl px-4 py-8 md:py-10">
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
