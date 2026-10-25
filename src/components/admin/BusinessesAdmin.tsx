import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListAllBusinesses,
  adminSetBusinessStatus,
  adminBusinessDeleteImpact,
  adminDeleteBusinessPermanently,
  adminLookupOwnerByEmail,
  adminAssignBusinessOwner,
} from "@/lib/businesses.functions";
import { Archive, ArchiveRestore, Download, ExternalLink, Loader2, MessageCircle, Phone, Plus, Trash2, TriangleAlert, UserCog } from "lucide-react";
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
import { readValidationError } from "@/lib/edit-lock";
import { telHref, whatsappHref } from "@/lib/phone";
import { buildLeadsCsv } from "@/lib/quick-add";
import { QuickAddLead } from "@/components/admin/QuickAddLead";

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
  const [toAssign, setToAssign] = useState<Row | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const chips: Chip<string>[] = useMemo(
    () => [
      { value: "all", label: "All", count: rows.length },
      { value: "quick", label: "Quick leads", count: rows.filter((r) => r.quickLead).length },
      ...STATUSES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1), count: rows.filter((r) => r.status === s).length })),
    ],
    [rows],
  );
  const shown = rows.filter(
    (r) =>
      (filter === "all" || (filter === "quick" ? r.quickLead : r.status === filter)) &&
      matchesSearch(search, { text: [r.name, r.city, r.categoryName, r.slug, r.email, r.planName, r.contactName, r.ownerEmail, r.leadSource], phones: [r.phone, r.phoneSecondary] }),
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin"] });

  const quickLeads = rows.filter((r) => r.quickLead);
  /** All quick leads as a CSV file for the follow-up calls (opens in Excel / Sheets; UTF-8 with a BOM so Gujarati / Hindi names stay readable). */
  const exportCsv = () => {
    const csv = buildLeadsCsv(quickLeads.map((r) => ({ name: r.name, contactName: r.contactName, phone: r.phone, categoryName: r.categoryName, city: r.city, leadSource: r.leadSource, created_at: r.created_at })));
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `kutchi-hub-quick-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`Exported ${quickLeads.length} lead${quickLeads.length === 1 ? "" : "s"}`);
  };

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
      <Button
        size="lg"
        className="h-12 w-full bg-[#ff6a00] text-base text-white hover:bg-[#e65a00] sm:w-auto"
        onClick={() => setShowQuickAdd((v) => !v)}
        aria-expanded={showQuickAdd}
      >
        <Plus className="mr-2 h-5 w-5" /> Quick add
      </Button>
      {showQuickAdd && <QuickAddLead onSaved={refresh} />}

      <div>
        <h2 className="text-xl font-bold text-foreground">Businesses</h2>
        <p className="text-sm text-muted-foreground">
          Archive hides a business from the whole website without deleting anything. Restore brings it back as published.
        </p>
      </div>

      <ListSearchInput value={text} onChange={setText} className="sm:max-w-sm" />
      <ChipRow chips={chips} value={filter} onChange={setFilter} label="Filter by status" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {shown.length} of {rows.length} businesses
        </p>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={quickLeads.length === 0}>
          <Download className="mr-1 h-4 w-4" /> Export CSV ({quickLeads.length} quick lead{quickLeads.length === 1 ? "" : "s"})
        </Button>
      </div>

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
                      {r.quickLead && r.status === "pending" && (
                        <Badge className="bg-amber-500 text-xs text-white hover:bg-amber-500">
                          {r.gaps.length > 0 ? "Quick lead - details incomplete" : "Quick lead"}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[r.city, r.categoryName].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-0.5 break-all text-xs text-muted-foreground">
                      Owner:{" "}
                      <span className="font-medium text-foreground">
                        {r.ownerEmail ?? (r.ownerId ? "account without e-mail" : "no owner")}
                      </span>
                    </p>
                    {r.quickLead && (
                      <div className="mt-2 space-y-2">
                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {r.contactName && <span>Contact: <span className="font-medium text-foreground">{r.contactName}</span></span>}
                          {r.leadSource && <Badge variant="secondary" className="text-xs font-normal">Source: {r.leadSource}</Badge>}
                          <span>Added {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                        </p>
                        {r.phone && (
                          <div className="flex flex-wrap items-center gap-2">
                            <Button asChild size="sm" variant="outline" className="h-9">
                              <a href={telHref(r.phone)}><Phone className="mr-1.5 h-4 w-4" /> Call {r.phone}</a>
                            </Button>
                            {whatsappHref(r.phone) && (
                              <Button asChild size="sm" variant="outline" className="h-9 border-green-600/40 text-green-700 hover:bg-green-50">
                                <a href={whatsappHref(r.phone)!} target="_blank" rel="noreferrer"><MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp</a>
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {r.status === "published" && (
                    <Link to="/business/$slug" params={{ slug: r.slug }} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      View <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setToAssign(r)}>
                      <UserCog className="mr-1 h-4 w-4" /> Assign owner
                    </Button>
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

      <AssignOwnerDialog
        row={toAssign}
        onClose={() => setToAssign(null)}
        onDone={async () => {
          setToAssign(null);
          await refresh();
        }}
      />

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

/**
 * Hand a business to a client by e-mail. Step 1: the e-mail is looked up on the server (admin only); an unknown e-mail shows
 * "No account with this email". Step 2: a confirmation naming the business and the new owner; only then is the owner changed.
 * The plan and subscriptions stay with the business.
 */
function AssignOwnerDialog({ row, onClose, onDone }: { row: Row | null; onClose: () => void; onDone: () => void | Promise<void> }) {
  const lookupFn = useServerFn(adminLookupOwnerByEmail);
  const assignFn = useServerFn(adminAssignBusinessOwner);
  const [email, setEmail] = useState("");
  const [found, setFound] = useState<{ userId: string; email: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const close = () => {
    if (busy) return;
    setEmail("");
    setFound(null);
    setError("");
    onClose();
  };

  const find = async () => {
    if (busy || !email.trim()) return;
    setBusy(true);
    setError("");
    try {
      setFound(await lookupFn({ data: { email: email.trim() } }));
    } catch (e) {
      setError(readableError(e, "Could not look up that email."));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!row || !found || busy) return;
    setBusy(true);
    setError("");
    try {
      await assignFn({ data: { businessId: row.id, userId: found.userId } });
      toast.success(`"${row.name}" is now owned by ${found.email}`);
      setEmail("");
      setFound(null);
      await onDone();
    } catch (e) {
      setError(readableError(e, "Could not assign the owner."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!row} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{found ? "Confirm new owner" : "Assign owner"}</DialogTitle>
          <DialogDescription>
            {found ? "Check this before you save." : "Enter the e-mail the client signed up with. They need an account first."}
          </DialogDescription>
        </DialogHeader>
        {row && (
          <div className="space-y-3 text-sm">
            {!found ? (
              <>
                <p className="rounded-md bg-muted/60 p-2">
                  <span className="text-muted-foreground">Business: </span>
                  <span className="font-medium text-foreground">{row.name}</span>
                  <br />
                  <span className="text-muted-foreground">Current owner: </span>
                  <span className="break-all text-foreground">{row.ownerEmail ?? "none"}</span>
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="owner-email">Client e-mail</Label>
                  <Input
                    id="owner-email"
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    value={email}
                    placeholder="client@example.com"
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void find(); } }}
                  />
                </div>
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" onClick={close} disabled={busy}>Cancel</Button>
                  <Button onClick={find} disabled={busy || !email.trim()}>
                    {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Find account
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-950">
                  Make <strong className="break-all">{found.email}</strong> the owner of <strong>{row.name}</strong>?
                  <br />
                  <span className="text-xs">
                    Current owner: {row.ownerEmail ?? "none"}. They lose access. The plan and subscriptions stay with the business, and the
                    new owner gets a notification.
                  </span>
                </p>
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" onClick={() => { setFound(null); setError(""); }} disabled={busy}>Back</Button>
                  <Button onClick={confirm} disabled={busy}>
                    {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <UserCog className="mr-1 h-4 w-4" />} Confirm transfer
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** The message of a failed server call; an input-check failure (zod) is turned into one readable line. */
function readableError(e: unknown, fallback: string): string {
  return readValidationError(e) ?? (e instanceof Error && e.message ? e.message : fallback);
}
