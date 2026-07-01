import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getBusinessBySlug, submitClaim } from "@/lib/businesses.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Building2, MapPin } from "lucide-react";

const businessQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: ["claim-business", slug],
    queryFn: () => getBusinessBySlug({ data: { slug } }),
  });

export const Route = createFileRoute("/_authenticated/business/$slug/claim")({
  head: () => ({
    meta: [
      { title: "Claim Business — NearMe" },
      { name: "description", content: "Submit a claim to manage this business listing." },
    ],
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(businessQueryOptions(params.slug)),
  component: ClaimBusinessPage,
});

function ClaimBusinessPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(businessQueryOptions(slug));
  const claimFn = useServerFn(submitClaim);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState("");

  if (!data.business) throw notFound();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await claimFn({ data: { businessId: data.business.id, message } });
      setResult("Your claim has been submitted for review.");
      setMessage("");
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Failed to submit claim");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Claim {data.business.name}</h1>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {data.business.city}
            </div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Submit a claim to become the owner of this business listing. An admin will review your request.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="message">Why should you manage this listing?</Label>
            <Textarea
              id="message"
              placeholder="e.g. I am the owner of this business..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
            />
          </div>
          {result && (
            <p className={`text-sm ${result.includes("submitted") ? "text-success" : "text-destructive"}`}>{result}</p>
          )}
          <Button type="submit" disabled={submitting} className="bg-primary text-primary-foreground">
            {submitting ? "Submitting..." : "Submit Claim"}
          </Button>
        </div>
      </form>
    </div>
  );
}
