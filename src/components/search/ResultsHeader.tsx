import { Fragment, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { listingCountLabel, resultsHeading } from "@/lib/search-filters";

type Crumb = { label: string; to?: { city?: string; category?: string; q?: string } };

/**
 * The top of the results: the trail "Home › City › Category › 24+ Listings" and the heading "Top Dentists in Bhuj".
 * `total` is null while the first answer is still loading (the trail then ends at the category).
 */
export function ResultsHeader({
  q,
  city,
  category,
  total,
  right,
}: {
  q?: string;
  city?: string;
  category?: { name: string; slug: string } | null;
  total: number | null;
  right?: ReactNode;
}) {
  const crumbs: Crumb[] = [{ label: "Home" }];
  if (city) crumbs.push({ label: city, to: { city } });
  if (category) crumbs.push({ label: category.name, to: { category: category.slug, ...(city ? { city } : {}) } });
  else if (q) crumbs.push({ label: `“${q}”` });
  if (total !== null) crumbs.push({ label: listingCountLabel(total) });

  return (
    <header className="mb-4">
      <nav aria-label="Breadcrumb" data-breadcrumb className="mb-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ol className="flex w-max items-center gap-1 whitespace-nowrap text-xs text-muted-foreground sm:text-sm">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <Fragment key={`${i}-${c.label}`}>
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                <li aria-current={last ? "page" : undefined}>
                  {last ? (
                    <span className="font-medium text-foreground">{c.label}</span>
                  ) : i === 0 ? (
                    <Link to="/" className="hover:text-foreground">
                      {c.label}
                    </Link>
                  ) : c.to ? (
                    <Link to="/search" search={c.to} className="hover:text-foreground">
                      {c.label}
                    </Link>
                  ) : (
                    <span>{c.label}</span>
                  )}
                </li>
              </Fragment>
            );
          })}
        </ol>
      </nav>
      <div className="flex items-end justify-between gap-3">
        <h1 data-results-heading className="text-2xl font-bold leading-tight text-foreground sm:text-3xl">
          {resultsHeading({ q, categoryName: category?.name, city })}
        </h1>
        {right}
      </div>
    </header>
  );
}
