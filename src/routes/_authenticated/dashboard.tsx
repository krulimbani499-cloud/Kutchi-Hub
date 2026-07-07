import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { getDashboard, deleteBusiness, updateClaimStatus } from "@/lib/businesses.functions";
import { getOwnerEnquiries, updateEnquiryStatus } from "@/lib/leads.functions";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Star, Trash2, Edit, MessageSquare, Phone, Mail, Inbox } from "lucide-react";

const dashboardQueryOptions = queryOptions({
  queryKey: ["dashboard"],
  queryFn: () => getDashboard(),
});

const enquiriesQueryOptions = queryOptions({
  queryKey: ["owner-enquiries"],
  queryFn: () => getOwnerEnquiries(),
});

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Kutchi Hub" },
      { name: "description", content: "Manage your business listings and claims." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQueryOptions),
  component: DashboardPage,
});

function DashboardPage() {
  const { data, refetch } = useSuspenseQuery(dashboardQueryOptions);
  const { data: enquiries = [], refetch: refetchEnquiries } = useQuery(enquiriesQueryOptions);
  const deleteFn = useServerFn(deleteBusiness);
  const updateClaimFn = useServerFn(updateClaimStatus);
  const updateEnquiryFn = useServerFn(updateEnquiryStatus);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this business?")) return;
    await deleteFn({ data: { id } });
    await refetch();
  };

  const handleClaim = async (claimId: string, status: "approved" | "rejected") => {
    await updateClaimFn({ data: { claimId, status } });
    await refetch();
  };

  const handleEnquiryStatus = async (id: string, status: "new" | "contacted" | "closed" | "spam") => {
    await updateEnquiryFn({ data: { id, status } });
    await refetchEnquiries();
  };

  const statusVariant = (s: string) =>
    s === "new" ? "default" : s === "contacted" ? "secondary" : s === "closed" ? "outline" : "destructive";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage your listings and ownership claims.</p>
        </div>
        <Button className="bg-primary text-primary-foreground" asChild>
          <Link to="/business/new">Add New Business</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                My Businesses
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.businesses.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  You haven't listed any businesses yet.
                  <div className="mt-4">
                    <Button className="bg-primary text-primary-foreground" asChild>
                      <Link to="/business/new">Add a business</Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {data.businesses.map((b) => (
                    <div key={b.id} className="flex items-start justify-between rounded-lg border border-border p-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">{b.name}</h3>
                          <Badge variant="outline" className="text-xs">
                            {b.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          {b.city}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Star className="h-3.5 w-3.5" />
                          {b.categoryName}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" asChild>
                          <Link to="/business/$slug/edit" params={{ slug: b.slug }}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(b.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Inbox className="h-5 w-5" />
                Enquiries / Leads
                {enquiries.filter((e) => e.status === "new").length > 0 && (
                  <Badge className="bg-[#ff6a00] text-white">
                    {enquiries.filter((e) => e.status === "new").length} new
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {enquiries.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No enquiries yet. Share your business link to receive leads.
                </p>
              ) : (
                <div className="space-y-3">
                  {enquiries.map((e) => (
                    <div key={e.id} className="rounded-lg border border-border p-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div>
                          <div className="font-medium text-foreground">{e.name}</div>
                          <div className="text-xs text-muted-foreground">
                            for <span className="font-medium">{e.businessName}</span> ·{" "}
                            {new Date(e.created_at).toLocaleString()}
                          </div>
                        </div>
                        <Badge variant={statusVariant(e.status)}>{e.status}</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <a href={`tel:${e.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                          <Phone className="h-3.5 w-3.5" /> {e.phone}
                        </a>
                        {e.email && (
                          <a href={`mailto:${e.email}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                            <Mail className="h-3.5 w-3.5" /> {e.email}
                          </a>
                        )}
                        {e.phone && (
                          <a
                            href={`https://wa.me/${e.phone.replace(/[^0-9]/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-green-700 hover:underline"
                          >
                            <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
                          </a>
                        )}
                      </div>
                      {e.service_needed && (
                        <p className="mt-2 text-sm">
                          <span className="text-muted-foreground">Service: </span>
                          <span className="text-foreground">{e.service_needed}</span>
                        </p>
                      )}
                      {e.message && (
                        <p className="mt-1 text-sm text-muted-foreground">{e.message}</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {e.status !== "contacted" && (
                          <Button size="sm" variant="outline" onClick={() => handleEnquiryStatus(e.id, "contacted")}>
                            Mark contacted
                          </Button>
                        )}
                        {e.status !== "closed" && (
                          <Button size="sm" variant="outline" onClick={() => handleEnquiryStatus(e.id, "closed")}>
                            Close
                          </Button>
                        )}
                        {e.status !== "spam" && (
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleEnquiryStatus(e.id, "spam")}>
                            Mark spam
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Claims
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.claims.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No claims found.</p>
              ) : (
                <div className="space-y-4">
                  {data.claims.map((claim) => (
                    <div key={claim.id} className="rounded-lg border border-border p-4">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-medium text-foreground">{claim.businessName}</span>
                        <Badge variant="outline">{claim.status}</Badge>
                      </div>
                      <p className="mb-2 text-xs text-muted-foreground">{claim.message || "No message"}</p>
                      {data.isAdmin && claim.status === "pending" && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="text-success" onClick={() => handleClaim(claim.id, "approved")}>
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleClaim(claim.id, "rejected")}>
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
