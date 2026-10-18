import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ListSearchInput } from "@/components/ListSearchInput";
import { ChipRow, type Chip } from "@/components/ChipRow";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { matchesSearch } from "@/lib/list-search";

export type FilterableBusiness = {
  name: string;
  slug: string;
  city: string | null;
  categoryName: string;
  status: string;
  phone: string | null;
  phoneSecondary: string | null;
  planName: string | null;
};

const planKey = (b: { planName: string | null }) => (b.planName ? b.planName.trim().toLowerCase() : "none");

/**
 * Search text + status + plan filters for the owner's business list. The state lives in the page that calls this
 * (not in the tab), so it survives switching tabs while the page is open; nothing is stored.
 */
export function useBusinessFilters<T extends FilterableBusiness>(businesses: T[]) {
  const [searchText, setSearchText] = useState("");
  const [status, setStatus] = useState("all");
  const [plan, setPlan] = useState("all");
  const search = useDebouncedValue(searchText, 150);

  const statusChips: Chip<string>[] = useMemo(
    () => [
      { value: "all", label: "All", count: businesses.length },
      // "Archived" only appears when the list has one (admins see them here; owners normally have none).
      ...((["published", "pending", "rejected", "archived"] as const).filter((s) => s !== "archived" || businesses.some((b) => b.status === "archived"))).map((s) => ({
        value: s,
        label: s[0].toUpperCase() + s.slice(1),
        count: businesses.filter((b) => b.status === s).length,
      })),
    ],
    [businesses],
  );
  const planChips: Chip<string>[] = useMemo(() => {
    const named: Array<[string, string]> = [["platinum", "Platinum"], ["gold", "Gold"], ["silver", "Silver"]];
    // Enterprise only gets a chip when the list has one (it would otherwise be reachable only through "All plans").
    if (businesses.some((b) => planKey(b) === "enterprise")) named.unshift(["enterprise", "Enterprise"]);
    return [
      { value: "all", label: "All plans" },
      ...named.map(([value, label]) => ({ value, label })),
      { value: "none", label: "No plan" },
    ];
  }, [businesses]);

  const filtered = useMemo(
    () =>
      businesses.filter(
        (b) =>
          (status === "all" || b.status === status) &&
          (plan === "all" || planKey(b) === plan) &&
          matchesSearch(search, { text: [b.name, b.city, b.categoryName, b.slug], phones: [b.phone, b.phoneSecondary] }),
      ),
    [businesses, search, status, plan],
  );
  const active = searchText.trim() !== "" || status !== "all" || plan !== "all";
  const clear = () => {
    setSearchText("");
    setStatus("all");
    setPlan("all");
  };

  return { searchText, setSearchText, status, setStatus, plan, setPlan, statusChips, planChips, filtered, total: businesses.length, active, clear };
}

type Filters = ReturnType<typeof useBusinessFilters>;

/** Search box, status and plan chips (scroll sideways on a phone), and the "12 of 38 businesses" line. */
export function BusinessFilterBar({ f }: { f: Pick<Filters, "searchText" | "setSearchText" | "status" | "setStatus" | "plan" | "setPlan" | "statusChips" | "planChips" | "filtered" | "total"> }) {
  return (
    <>
      <div className="mb-4 space-y-3 lg:flex lg:flex-wrap lg:items-center lg:gap-3 lg:space-y-0">
        <ListSearchInput value={f.searchText} onChange={f.setSearchText} className="lg:w-80 lg:shrink-0" />
        <div className="min-w-0 space-y-2 lg:flex lg:flex-wrap lg:items-center lg:gap-3 lg:space-y-0">
          <ChipRow chips={f.statusChips} value={f.status} onChange={f.setStatus} label="Filter by status" />
          <ChipRow chips={f.planChips} value={f.plan} onChange={f.setPlan} label="Filter by plan" />
        </div>
      </div>
      <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
        {f.filtered.length} of {f.total} {f.total === 1 ? "business" : "businesses"}
      </p>
    </>
  );
}

/** Shown instead of the list when nothing matches. */
export function NoBusinessMatch({ f }: { f: Pick<Filters, "active" | "clear"> }) {
  return (
    <div className="rounded-lg border border-dashed border-border py-10 text-center">
      <p className="font-medium text-foreground">Koi business nahi mila</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={f.clear} disabled={!f.active}>
        Clear
      </Button>
    </div>
  );
}
