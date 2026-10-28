import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, MessageCircle, Phone, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ListSearchInput } from "@/components/ListSearchInput";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { matchesSearch } from "@/lib/list-search";
import { telHref, whatsappHref } from "@/lib/phone";
import { buildSearchLeadsCsv } from "@/lib/search-leads";
import { adminListSearchLeads } from "@/lib/search-leads.functions";

/** Admin > "Search leads": people who asked for the list of top businesses on a results page. Tap to call, export to CSV. */
export function SearchLeadsManager() {
  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-search-leads"],
    queryFn: () => adminListSearchLeads(),
    staleTime: 30_000,
  });
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search, 250);
  const rows = data?.rows ?? [];
  const shown = useMemo(
    () => rows.filter((r) => matchesSearch(q, { text: [r.name, r.categoryName, r.city, r.sourcePage], phones: [r.phone] })),
    [rows, q],
  );

  /** The leads on screen as a CSV file for the follow-up calls (UTF-8 with a BOM so Gujarati / Hindi names stay readable in Excel). */
  const exportCsv = () => {
    const csv = buildSearchLeadsCsv(shown);
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `kutchi-hub-search-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (isPending) return <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>;
  if (isError) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-destructive">
          {error instanceof Error ? error.message : "Could not load the leads."}
          <div className="mt-3">
            <Button size="sm" variant="outline" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  if (!data.ready) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Search leads are not set up yet.</p>
          <p className="mt-1">
            The database update <code className="rounded bg-muted px-1">supabase/pending/search-leads</code> has not been applied. Until then the
            "Get the list" form tells visitors to call or WhatsApp Kutchi Hub instead of saving their request.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Search leads</h2>
          <p className="text-sm text-muted-foreground">People who asked for the list of top businesses. Call them from here.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{rows.length} total</Badge>
          <Button size="sm" variant="outline" onClick={() => void refetch()} disabled={isFetching} aria-label="Refresh">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={shown.length === 0} data-export-leads>
            <Download className="mr-1 h-4 w-4" /> Export CSV ({shown.length})
          </Button>
        </div>
      </div>

      <ListSearchInput value={search} onChange={setSearch} placeholder="Search name, phone, category, city" />

      {shown.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">{rows.length === 0 ? "No requests yet." : "No lead matches your search."}</CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {shown.map((r) => {
            const wa = whatsappHref(r.phone, `Hi ${r.name}, this is Kutchi Hub. You asked for the list of top ${r.categoryName ?? "businesses"}.`);
            return (
              <Card key={r.id} data-lead-row>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{r.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {[r.categoryName, r.city].filter(Boolean).join(" · ") || "No category or city"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                      {r.sourcePage ? ` · ${r.sourcePage}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button asChild size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700">
                      <a href={telHref(r.phone)} aria-label={`Call ${r.name}`}>
                        <Phone className="mr-1 h-4 w-4" /> {r.phone}
                      </a>
                    </Button>
                    {wa && (
                      <Button asChild size="sm" variant="outline">
                        <a href={wa} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${r.name}`}>
                          <MessageCircle className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
