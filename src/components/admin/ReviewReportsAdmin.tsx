import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { EyeOff, Eye, Flag, X, ExternalLink, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { adminListReviewReports, adminResolveReviewReport, type AdminReviewReport } from "@/lib/review-moderation.functions";

const REASON_LABEL: Record<string, string> = { spam: "Spam", abusive: "Abusive", fake: "Fake", other: "Other" };

/** Admin queue for reviews that users reported (App Store guideline 1.2). */
export function ReviewReportsAdmin() {
  const listFn = useServerFn(adminListReviewReports);
  const resolveFn = useServerFn(adminResolveReviewReport);
  const { data: reports = [], refetch, isLoading, error } = useQuery({
    queryKey: ["admin", "review-reports"],
    queryFn: () => listFn(),
  });
  const [filter, setFilter] = useState<"open" | "closed">("open");
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (r: AdminReviewReport, action: "hide" | "dismiss" | "unhide") => {
    setBusy(r.id);
    try {
      await resolveFn({ data: { reportId: r.id, action } });
      toast.success(action === "hide" ? "Review hidden" : action === "unhide" ? "Review is visible again" : "Report closed");
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(null);
    }
  };

  const open = reports.filter((r) => r.status === "open");
  const shown = reports.filter((r) => r.status === filter);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <Flag className="h-5 w-5 text-destructive" /> Reported reviews
          </h2>
          <p className="text-sm text-muted-foreground">
            Reviews that signed-in users reported. Hide removes the review from the public page and from the rating average.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{open.length} open</Badge>
          <Button size="sm" variant={filter === "open" ? "default" : "outline"} onClick={() => setFilter("open")}>Open</Button>
          <Button size="sm" variant={filter === "closed" ? "default" : "outline"} onClick={() => setFilter("closed")}>Closed</Button>
        </div>
      </div>

      {error ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-destructive">
            {error instanceof Error ? error.message : "Could not load reports"}
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">Loading…</CardContent>
        </Card>
      ) : shown.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {filter === "open" ? "No open review reports." : "No closed review reports yet."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {shown.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="destructive">{REASON_LABEL[r.reason] ?? r.reason}</Badge>
                    {r.hidden && <Badge variant="secondary">Hidden</Badge>}
                    {r.reportCount > 1 && <Badge variant="outline">{r.reportCount} reports on this review</Badge>}
                    {r.status === "closed" && (
                      <Badge variant="outline">{r.admin_action === "hidden" ? "Closed: hidden" : "Closed: dismissed"}</Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                </div>

                {r.details && (
                  <p className="mb-2 text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">Reporter note: </span>
                    {r.details}
                  </p>
                )}

                {r.review ? (
                  <div className="rounded-lg border border-border bg-muted/40 p-3">
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        {Array.from({ length: r.review.rating }).map((_, i) => (
                          <Star key={i} className="h-3.5 w-3.5 fill-rating text-rating" />
                        ))}
                      </span>
                      {r.review.business && (
                        <Link
                          to="/business/$slug"
                          params={{ slug: r.review.business.slug }}
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          {r.review.business.name} <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-foreground">
                      {r.review.review || <span className="text-muted-foreground">(rating only, no text)</span>}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">author {r.review.user_id.slice(0, 8)}…</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">The review no longer exists.</p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {r.hidden ? (
                    <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => act(r, "unhide")}>
                      <Eye className="mr-1 h-3.5 w-3.5" /> Show review again
                    </Button>
                  ) : (
                    r.review && (
                      <Button size="sm" variant="outline" className="text-destructive" disabled={busy === r.id} onClick={() => act(r, "hide")}>
                        <EyeOff className="mr-1 h-3.5 w-3.5" /> Hide review
                      </Button>
                    )
                  )}
                  {r.status === "open" && (
                    <Button size="sm" variant="ghost" className="text-muted-foreground" disabled={busy === r.id} onClick={() => act(r, "dismiss")}>
                      <X className="mr-1 h-3.5 w-3.5" /> Close report
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
