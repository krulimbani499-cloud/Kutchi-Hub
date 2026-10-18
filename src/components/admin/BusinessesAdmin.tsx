import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListAllBusinesses,
  adminSetBusinessStatus,
  adminBusinessDeleteImpact,
  adminDeleteBusinessPermanently,
} from "@/lib/businesses.functions";
import { Archive, ArchiveRestore, ExternalLink, Loader2, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ListSearchInput } from "@/components/ListSearchInput";
import { ChipRow, type Chip } from "@/components/ChipRow";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { matchesSearch } from "@/lib/list-search";

type Row = Awaited<ReturnType<typeof adminListAllBusinesses>>[number];

const STATUSES = ["published", "pending", "rejected", "archived"] as const;

/**
 * All businesses, by status. Admins ARCHIVE a business (hidden everywhere public, nothing deleted) and RESTORE it from the
 * Archived filter. Permanent delete exists only there, behind a dialog that needs the exact business name.
 */
export function BusinessesAdmin() {
  const queryClient = useQueryClient();
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["admin", "all-businesses"],
    queryFn: () => adminListAllBusinesses(),
  });
  const rows = useMemo(() => data ?? [], [data]);
  const setStatusFn = useServerFn(adminSetBusinessStatus);
  const [filter, setFilter] = useState("all");
  const [text, setText] = useState("");
  const search = useDebouncedValue(text, 150);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Row | null>(null);

  const chips: Chip<string>[] = useMemo(
    () => [
      { value: "all", label: "All", count: rows.length },
      ...STATUSES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1), count: rows.filter((r) => r.status === s).length })),
    ],
    [rows],
  );
  const shown = rows.filter(
    (r) =>
      (filter === "all" || r.status === filter) &&
      matchesSearch(search, { text: [r.name, r.city, r.categoryName, r.slug, r.email, r.planName], phones: [r.phone, r.phoneSecondary] }),
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin"] });

  const change = async (r: Row, status: "archived" | "published") => {
    if (status === "archived" && !confirm(`Archive "${r.name}"?\n\nIt will disappear from the website. Its subscription and payment history are kept, and you can restore it from the Archived filter.`)) return;
    setBusyId(r.id);
    try {
      await setStatusFn({ data: { id: r.id, status } });
      toast.success(status === "archived" ? "Business archived" : "Business restored");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-foreground">Businesses</h2>
        <p className="text-sm text-muted-foreground">
          Archive hides a business from the whole website without deleting anything. Restore brings it back as published.
        </p>
      </div>

      <ListSearchInput value={text} onChange={setText} className="sm:max-w-sm" />
      <ChipRow chips={chips} value={filter} onChange={setFilter} label="Filter by status" />
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {shown.length} of {rows.length} businesses
      </p>

      {isPending && !data ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Loading…</CardContent></Card>
      ) : isError && !data ? (
        <Card><CardContent className="p-6 text-center text-sm text-destructive">{error instanceof Error ? error.message : "Could not load businesses"}</CardContent></Card>
      ) : shown.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="font-medium text-foreground">Koi business nahi mila</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => { setText(""); setFilter("all"); }}>Clear</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {shown.slice(0, 200).map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 p-4">
                  {/* Full width on a phone (the buttons wrap underneath), side by side from sm up. */}
                  <div className="min-w-0 basis-full sm:flex-1 sm:basis-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 break-words font-medium text-foreground">{r.name}</span>
                      <Badge variant={r.status === "archived" ? "secondary" : "outline"} className="text-xs capitalize">{r.status}</Badge>
                      {r.planName && <Badge className="bg-[#ff6a00] text-xs text-white">{r.planName}</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[r.city, r.categoryName].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {r.status === "published" && (
                    <Link to="/business/$slug" params={{ slug: r.slug }} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      View <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {r.status === "archived" ? (
                      <>
                        <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => change(r, "published")}>
                          {busyId === r.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ArchiveRestore className="mr-1 h-4 w-4" />} Restore
                        </Button>
                        {/* Permanent delete exists only here, on the Archived filter. */}
                        {filter === "archived" && (
                          <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => setToDelete(r)}>
                            <Trash2 className="mr-1 h-4 w-4" /> Delete permanently
                          </Button>
                        )}
                      </>
                    ) : (
                      <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => change(r, "archived")}>
                        {busyId === r.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Archive className="mr-1 h-4 w-4" />} Archive
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <PermanentDeleteDialog
        row={toDelete}
        onClose={() => setToDelete(null)}
        onDone={async () => {
          setToDelete(null);
          await refresh();
        }}
      />
    </div>
  );
}

function PermanentDeleteDialog({ row, onClose, onDone }: { row: Row | null; onClose: () => void; onDone: () => void | Promise<void> }) {
  const deleteFn = useServerFn(adminDeleteBusinessPermanently);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: impact } = useQuery({
    queryKey: ["admin", "delete-impact", row?.id],
    queryFn: () => adminBusinessDeleteImpact({ data: { id: row!.id } }),
    enabled: !!row,
  });
  // Exact match, character for character.
  const matches = !!row && typed === row.name;

  const close = () => {
    setTyped("");
    onClose();
  };

  const run = async () => {
    if (!row || !matches) return;
    setBusy(true);
    try {
      await deleteFn({ data: { id: row.id, confirmName: typed } });
      toast.success("Business deleted permanently");
      setTyped("");
      await onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!row} onOpenChange={(open) => { if (!open && !busy) close(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <TriangleAlert className="h-5 w-5" /> Delete permanently
          </DialogTitle>
          <DialogDescription>This cannot be undone.</DialogDescription>
        </DialogHeader>
        {row && (
          <div className="space-y-3 text-sm">
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive">
              <strong>Subscription and payment history will be deleted too</strong>
              {impact && impact.subscriptions > 0
                ? ` (${impact.subscriptions} subscription record${impact.subscriptions === 1 ? "" : "s"}, ₹${impact.totalPaid.toLocaleString("en-IN")} recorded as paid)`
                : impact
                  ? " (none recorded)"
                  : ""}
              , along with its reviews, photos, products, services, enquiries and favourites.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-name">
                Type the business name exactly to confirm: <span className="font-semibold text-foreground">{row.name}</span>
              </Label>
              <Input id="confirm-name" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" placeholder={row.name} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={close} disabled={busy}>Cancel</Button>
              <Button variant="destructive" onClick={run} disabled={!matches || busy}>
                {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1 h-4 w-4" />} Delete permanently
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
