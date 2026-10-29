import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { LandingCopy } from "@/lib/seo-landing";

/** The short intro under the heading (written from the page's own data, see seo-landing.ts). */
export function LandingIntro({ paragraphs }: { paragraphs: string[] }) {
  return (
    <div data-landing-intro className="mb-5 max-w-3xl space-y-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

/** The questions and answers at the bottom of the page. The same text is in the page's FAQPage JSON-LD. */
export function LandingFaq({ faq }: { faq: LandingCopy["faq"] }) {
  if (faq.length === 0) return null;
  return (
    <section data-landing-faq aria-labelledby="landing-faq" className="mt-10 max-w-3xl">
      <h2 id="landing-faq" className="mb-3 text-lg font-semibold text-foreground">
        Frequently asked questions
      </h2>
      <dl className="space-y-3">
        {faq.map((qa) => (
          <div key={qa.q} className="rounded-xl border border-border bg-card p-4">
            <dt className="font-medium text-foreground">{qa.q}</dt>
            <dd className="mt-1 text-sm text-muted-foreground">{qa.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const chip =
  "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground hover:bg-muted";

/** A titled row of links to other landing pages (internal links for visitors and search engines). */
export function LinkChips({ title, children }: { title: string; children: ReactNode }) {
  return (
    <nav data-link-chips aria-label={title} className="mb-5">
      <h2 className="mb-2 text-sm font-semibold text-foreground">{title}</h2>
      {/* Phones: one line that scrolls sideways (the results stay near the top); wide screens: wraps. All links are in the page either way. */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden">{children}</div>
    </nav>
  );
}

export function CityChip({ slug, category, name, count }: { slug: string; category?: string; name: string; count?: number }) {
  const body = (
    <>
      {name}
      {count !== undefined && <span className="text-muted-foreground">({count})</span>}
    </>
  );
  return category ? (
    <Link to="/city/$slug/category/$category" params={{ slug, category }} className={chip}>
      {body}
    </Link>
  ) : (
    <Link to="/city/$slug" params={{ slug }} className={chip}>
      {body}
    </Link>
  );
}

export function CategoryChip({ citySlug, slug, name, count }: { citySlug?: string; slug: string; name: string; count?: number }) {
  const body = (
    <>
      {name}
      {count !== undefined && <span className="text-muted-foreground">({count})</span>}
    </>
  );
  return citySlug ? (
    <Link to="/city/$slug/category/$category" params={{ slug: citySlug, category: slug }} className={chip}>
      {body}
    </Link>
  ) : (
    <Link to="/category/$slug" params={{ slug }} className={chip}>
      {body}
    </Link>
  );
}
