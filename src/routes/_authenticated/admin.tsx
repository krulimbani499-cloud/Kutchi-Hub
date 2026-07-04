import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listPendingBusinesses, reviewBusinessSubmission } from "@/lib/businesses.functions";
import { getDashboard } from "@/lib/businesses.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, ExternalLink, MapPin, Phone, Mail, Globe } from "lucide-react";
import { toast } from "sonner";

const pendingQueryOptions = queryOptions({
  queryKey: ["admin", "pending-businesses"],
  queryFn: () => listPendingBusinesses(),
});

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Kutchi Hub" },
      { name: "description", content: "Approve or reject business submissions." },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context }) => {
    const dash = await getDashboard();
    if (!dash.isAdmin) throw redirect({ to: "/dashboard" });
    await context.queryClient.ensureQueryData(pendingQueryOptions);
  },
  component: AdminPage,
});

function AdminPage() {
  const { data: pending, refetch } = useSuspenseQuery(pendingQueryOptions);
  const reviewFn = useServerFn(reviewBusinessSubmission);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleAction = async (id: string, action: "approve" | "reject") => {
    setBusyId(id);
    try {
      await reviewFn({ data: { id, action } });
      toast.success(action === "approve" ? "Business approved" : "Business rejected");
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">Review and approve business submissions.</p>
        </div>
        <Badge variant="secondary">{pending.length} pending</Badge>
      </div>

      {pending.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No pending submissions. All caught up!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pending.map((b) => (
            <Card key={b.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div className="min-w-0 flex-1">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                    <span className="truncate">{b.name}</span>
                    {b.categoryName ? <Badge variant="outline">{b.categoryName}</Badge> : null}
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Submitted {new Date(b.created_at).toLocaleString()}
                  </p>
                </div>
                <Link
                  to="/business/$slug"
                  params={{ slug: b.slug }}
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  Preview <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </CardHeader>
              <CardContent className="space-y-3">
                {b.description ? (
                  <p className="text-sm text-foreground/80">{b.description}</p>
                ) : null}
                <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                  {b.address || b.city ? (
                    <div className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{[b.address, b.city, b.state].filter(Boolean).join(", ")}</span>
                    </div>
                  ) : null}
                  {b.phone ? (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 shrink-0" />
                      <span>{b.phone}</span>
                    </div>
                  ) : null}
                  {b.email ? (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 shrink-0" />
                      <span className="truncate">{b.email}</span>
                    </div>
                  ) : null}
                  {b.website ? (
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 shrink-0" />
                      <a
                        href={b.website}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="truncate text-primary hover:underline"
                      >
                        {b.website}
                      </a>
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={() => handleAction(b.id, "approve")}
                    disabled={busyId === b.id}
                  >
                    <Check className="mr-1.5 h-4 w-4" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleAction(b.id, "reject")}
                    disabled={busyId === b.id}
                  >
                    <X className="mr-1.5 h-4 w-4" /> Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}