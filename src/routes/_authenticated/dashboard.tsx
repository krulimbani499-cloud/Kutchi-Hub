import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { getDashboard, deleteBusiness, updateClaimStatus } from "@/lib/businesses.functions";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Star, Trash2, Edit, MessageSquare } from "lucide-react";

const dashboardQueryOptions = queryOptions({
  queryKey: ["dashboard"],
  queryFn: () => getDashboard(),
});

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — NearMe" },
      { name: "description", content: "Manage your business listings and claims." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQueryOptions),
  component: DashboardPage,
});

function DashboardPage() {
  const { data, refetch } = useSuspenseQuery(dashboardQueryOptions);
  const deleteFn = useServerFn(deleteBusiness);
  const updateClaimFn = useServerFn(updateClaimStatus);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this business?")) return;
    await deleteFn({ data: { id } });
    await refetch();
  };

  const handleClaim = async (claimId: string, status: "approved" | "rejected") => {
    await updateClaimFn({ data: { claimId, status } });
    await refetch();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage your listings and ownership claims.</p>
        </div>
        <Button className="bg-primary text-primary-foreground" asChild>
          <Link to="/_authenticated/business/new">Add New Business</Link>
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
                      <Link to="/_authenticated/business/new">Add a business</Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {data.businesses.map((b) => (
                    <div key={b.id} className="flex items-start justify-between rounded-lg border border-border p-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">{(b as unknown as { name: string }).name}</h3>
                          <Badge variant="outline" className="text-xs">
                            {(b as unknown as { status: string }).status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          {(b as unknown as { city: string | null }).city}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Star className="h-3.5 w-3.5" />
                          {(b as unknown as { categories: { name: string } | null }).categories?.name}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" asChild>
                          <Link to="/_authenticated/business/$slug/edit" params={{ slug: (b as unknown as { slug: string }).slug }}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete((b as unknown as { id: string }).id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
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
                        <span className="font-medium text-foreground">{(claim as unknown as { businesses: { name: string } }).businesses.name}</span>
                        <Badge variant="outline">{(claim as unknown as { status: string }).status}</Badge>
                      </div>
                      <p className="mb-2 text-xs text-muted-foreground">{(claim as unknown as { message: string | null }).message || "No message"}</p>
                      {data.isAdmin && (claim as unknown as { status: string }).status === "pending" && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="text-success" onClick={() => handleClaim((claim as unknown as { id: string }).id, "approved")}>
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleClaim((claim as unknown as { id: string }).id, "rejected")}>
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
