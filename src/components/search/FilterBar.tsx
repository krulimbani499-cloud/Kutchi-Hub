import { useEffect, useState, type ReactNode } from "react";
import { BadgeCheck, ChevronDown, Clock, Loader2, SlidersHorizontal, Star, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { activeFilterCount, SORT_OPTIONS, type SearchParams, type SortValue } from "@/lib/search-filters";

type CategoryOption = { id: string; name: string; slug: string };

/** What the "All Filters" panel edits. The city is text here ("" = every city). */
export type FilterDraft = {
  q: string;
  category: string;
  city: string;
  sort: SortValue;
  rating: boolean;
  open: boolean;
  verified: boolean;
  offer: boolean;
};

const chipClass = (active: boolean) =>
  `inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors ${
    active
      ? "border-[#ff6a00] bg-[#ff6a00] text-white"
      : "border-border bg-background text-foreground hover:border-[#ff6a00]/40 hover:text-[#ff6a00]"
  }`;

/**
 * The row of filter chips above the results: Sort by, Rating 4+, Open now, Verified, Has offer and "All Filters".
 * Phones: the chips scroll sideways and All Filters opens as a sheet from the bottom. Wide screens: the chips sit in a row,
 * Sort by is a dropdown and All Filters opens as a dropdown panel. Nothing here talks to the server: every change goes
 * to the page, which puts it in the address.
 */
export function FilterBar({
  params,
  city,
  categories,
  categoriesPending,
  locating,
  onSort,
  onToggle,
  onClearQuery,
  onApply,
  onClearChips,
  onClearAll,
}: {
  params: SearchParams;
  /** The city the list is for ("" = every city). */
  city: string;
  categories: CategoryOption[];
  categoriesPending: boolean;
  /** Waiting for the device position after "Nearest" was picked. */
  locating: boolean;
  onSort: (value: SortValue) => void;
  onToggle: (key: "rating" | "open" | "verified" | "offer") => void;
  onClearQuery: () => void;
  onApply: (draft: FilterDraft) => void;
  onClearChips: () => void;
  onClearAll: () => void;
}) {
  const sort: SortValue = params.sort ?? "relevance";
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "Relevance";
  const count = activeFilterCount(params);
  const anyChip = !!(params.rating || params.open || params.verified || params.offer);

  return (
    <div data-filter-bar className="mb-4">
      <div
        data-chip-row
        className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden"
      >
        <AllFilters
          className="order-first md:order-last md:ml-auto"
          params={params}
          city={city}
          count={count}
          categories={categories}
          categoriesPending={categoriesPending}
          onApply={onApply}
          onClearAll={onClearAll}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" data-chip="sort" className={chipClass(sort !== "relevance")}>
              {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <span>Sort by: {locating ? "Locating…" : sortLabel}</span>
              <ChevronDown className="h-4 w-4 opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuRadioGroup value={sort} onValueChange={(v) => onSort(v as SortValue)}>
              {SORT_OPTIONS.map((o) => (
                <DropdownMenuRadioItem key={o.value} value={o.value}>
                  {o.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {params.q && (
          <button type="button" data-chip="query" onClick={onClearQuery} className={chipClass(true)} aria-label={`Remove search “${params.q}”`}>
            <span className="max-w-[10rem] truncate">“{params.q}”</span>
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <button type="button" data-chip="rating" aria-pressed={!!params.rating} onClick={() => onToggle("rating")} className={chipClass(!!params.rating)}>
          <Star className="h-4 w-4" /> Rating 4+
        </button>
        <button type="button" data-chip="open" aria-pressed={!!params.open} onClick={() => onToggle("open")} className={chipClass(!!params.open)}>
          <Clock className="h-4 w-4" /> Open now
        </button>
        <button type="button" data-chip="verified" aria-pressed={!!params.verified} onClick={() => onToggle("verified")} className={chipClass(!!params.verified)}>
          <BadgeCheck className="h-4 w-4" /> Verified
        </button>
        <button type="button" data-chip="offer" aria-pressed={!!params.offer} onClick={() => onToggle("offer")} className={chipClass(!!params.offer)}>
          <Tag className="h-4 w-4" /> Has offer
        </button>
        {anyChip && (
          <button
            type="button"
            data-chip="clear"
            onClick={onClearChips}
            className="inline-flex h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>
    </div>
  );
}

function AllFilters({
  className = "",
  params,
  city,
  count,
  categories,
  categoriesPending,
  onApply,
  onClearAll,
}: {
  className?: string;
  params: SearchParams;
  city: string;
  count: number;
  categories: CategoryOption[];
  categoriesPending: boolean;
  onApply: (draft: FilterDraft) => void;
  onClearAll: () => void;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const trigger = (
    <button type="button" data-chip="all-filters" className={`${chipClass(count > 0)} ${className}`}>
      <SlidersHorizontal className="h-4 w-4" />
      All Filters
      {count > 0 && (
        <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-xs font-bold text-[#ff6a00]">{count}</span>
      )}
    </button>
  );
  const panel = (
    <FiltersPanel
      params={params}
      city={city}
      categories={categories}
      categoriesPending={categoriesPending}
      onApply={(d) => {
        onApply(d);
        setOpen(false);
      }}
      onClearAll={() => {
        onClearAll();
        setOpen(false);
      }}
    />
  );

  // Phones: a sheet from the bottom. Wide screens: a dropdown panel under the button.
  if (isMobile) {
    return (
      <>
        <button type="button" data-chip="all-filters" onClick={() => setOpen(true)} className={`${chipClass(count > 0)} ${className}`}>
          <SlidersHorizontal className="h-4 w-4" />
          All Filters
          {count > 0 && (
            <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-xs font-bold text-[#ff6a00]">{count}</span>
          )}
        </button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" data-filters-sheet className="max-h-[88vh] overflow-y-auto rounded-t-2xl px-4 pb-6 pt-5">
            <SheetHeader className="mb-3 text-left">
              <SheetTitle>All Filters</SheetTitle>
              <SheetDescription className="sr-only">Choose what to show in the results.</SheetDescription>
            </SheetHeader>
            {panel}
          </SheetContent>
        </Sheet>
      </>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" data-filters-popover className="w-[26rem] max-w-[calc(100vw-2rem)] p-4">
        {panel}
      </PopoverContent>
    </Popover>
  );
}

function FiltersPanel({
  params,
  city,
  categories,
  categoriesPending,
  onApply,
  onClearAll,
}: {
  params: SearchParams;
  city: string;
  categories: CategoryOption[];
  categoriesPending: boolean;
  onApply: (draft: FilterDraft) => void;
  onClearAll: () => void;
}) {
  const [draft, setDraft] = useState<FilterDraft>(() => ({
    q: params.q ?? "",
    category: params.category ?? "all",
    city,
    sort: params.sort ?? "relevance",
    rating: !!params.rating,
    open: !!params.open,
    verified: !!params.verified,
    offer: !!params.offer,
  }));
  // The panel is rebuilt each time it opens; keep it in step if the address changed while it stayed mounted.
  useEffect(() => {
    setDraft((d) => ({ ...d, q: params.q ?? "", category: params.category ?? "all", city }));
  }, [params.q, params.category, city]);
  const set = <K extends keyof FilterDraft>(key: K, value: FilterDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  return (
    <form
      data-filters-panel
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onApply(draft);
      }}
    >
      <Field label="Search" htmlFor="flt-q">
        <Input id="flt-q" value={draft.q} onChange={(e) => set("q", e.target.value)} placeholder="Name, service or product" maxLength={100} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" htmlFor="flt-category">
          {categoriesPending ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select value={draft.category} onValueChange={(v) => set("category", v)}>
              <SelectTrigger id="flt-category">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.slug}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label="City" htmlFor="flt-city">
          <Input id="flt-city" value={draft.city} onChange={(e) => set("city", e.target.value)} placeholder="All locations" maxLength={80} />
        </Field>
      </div>
      <Field label="Sort by" htmlFor="flt-sort">
        <Select value={draft.sort} onValueChange={(v) => set("sort", v as SortValue)}>
          <SelectTrigger id="flt-sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Toggle id="flt-rating" label="Rating 4+" checked={draft.rating} onChange={(v) => set("rating", v)} />
        <Toggle id="flt-open" label="Open now" checked={draft.open} onChange={(v) => set("open", v)} />
        <Toggle id="flt-verified" label="Verified" checked={draft.verified} onChange={(v) => set("verified", v)} />
        <Toggle id="flt-offer" label="Has offer" checked={draft.offer} onChange={(v) => set("offer", v)} />
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onClearAll}>
          Clear all
        </Button>
        <Button type="submit" className="flex-1" data-apply-filters>
          Show results
        </Button>
      </div>
    </form>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function Toggle({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      {label}
    </label>
  );
}
