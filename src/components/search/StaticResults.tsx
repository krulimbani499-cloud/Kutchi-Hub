import { Fragment, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { SlidersHorizontal } from "lucide-react";
import { LeadForm } from "./LeadForm";
import { ResultCard, type ResultBusiness } from "./ResultCard";
import type { SearchParams } from "@/lib/search-filters";

/** On a phone the "Get the list" form sits in the list after this many results. */
const PHONE_FORM_AFTER = 5;

/**
 * The list layout of the category / city landing pages (their businesses are loaded with the page, so they can be found by
 * search engines): the same result cards and the same "Get the list of top ..." form as the search page. Sorting and
 * filtering live on the search page: the "Filter and sort" link opens it with this category / city already chosen.
 */
export function StaticResults({
  businesses,
  category,
  city,
  filterSearch,
  banner,
  empty,
}: {
  businesses: ResultBusiness[];
  category?: { id: string; name: string } | null;
  city?: string | null;
  /** What the "Filter and sort" link carries over to the search page. */
  filterSearch: SearchParams;
  /** Shown above the list (e.g. the category banner). */
  banner?: ReactNode;
  /** Shown instead of the list when there are no businesses. */
  empty: ReactNode;
}) {
  const form = (className = "") => <LeadForm categoryId={category?.id ?? null} categoryName={category?.name ?? null} city={city} className={className} />;
  const formAt = Math.min(PHONE_FORM_AFTER, businesses.length) - 1;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        {banner}
        {businesses.length === 0 ? (
          <>
            {empty}
            <div className="mt-4 lg:hidden">{form()}</div>
          </>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {businesses.length} {businesses.length === 1 ? "result" : "results"}
              </p>
              <Link
                to="/search"
                search={filterSearch}
                data-filter-link
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-background px-3.5 text-sm font-medium text-foreground hover:border-[#ff6a00]/40 hover:text-[#ff6a00]"
              >
                <SlidersHorizontal className="h-4 w-4" /> Filter and sort
              </Link>
            </div>
            <div data-results-list className="flex flex-col gap-4">
              {businesses.map((b, i) => (
                <Fragment key={b.id}>
                  <ResultCard business={b} priority={i < 2} />
                  {i === formAt && <div className="lg:hidden">{form()}</div>}
                </Fragment>
              ))}
            </div>
          </>
        )}
      </div>
      <aside className="hidden lg:block" aria-label="Get the list">
        <div className="sticky top-24">{form()}</div>
      </aside>
    </div>
  );
}
