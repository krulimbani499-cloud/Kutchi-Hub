import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listActivePlans, listAdSlots } from "@/lib/plans.functions";
import { PlanCard } from "@/components/pricing/PlanCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BASE_URL } from "@/lib/seo";
import { Phone, MessageCircle, Mail, Megaphone } from "lucide-react";

const CONTACT_WHATSAPP = "919999999999"; // Admin can update
const CONTACT_PHONE = "+91 99999 99999";
const CONTACT_EMAIL = "hello@kutchihub.com";

const plansQueryOptions = queryOptions({
  queryKey: ["public-plans"],
  queryFn: () => listActivePlans(),
});
const adSlotsQueryOptions = queryOptions({
  queryKey: ["public-ad-slots"],
  queryFn: () => listAdSlots(),
});

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Grow your business on Kutchi Hub" },
      { name: "description", content: "Simple, transparent pricing for Kutchi businesses. Choose Free, Silver, Gold or Platinum plans and get more customers on Kutchi Hub." },
      { property: "og:title", content: "Pricing — Kutchi Hub" },
      { property: "og:description", content: "Simple, transparent pricing for Kutchi businesses." },
      { property: "og:url", content: `${BASE_URL}/pricing` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${BASE_URL}/pricing` }],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(plansQueryOptions),
      context.queryClient.ensureQueryData(adSlotsQueryOptions),
    ]);
  },
  component: PricingPage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-4 py-12 text-center">
      <p className="text-sm text-destructive">Failed to load pricing: {error.message}</p>
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-center">Not found</div>,
});

function PricingPage() {
  const { data: plans } = useSuspenseQuery(plansQueryOptions);
  const { data: adSlots } = useSuspenseQuery(adSlotsQueryOptions);
  const cycle = "yearly" as const;

  const contactHref = `https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent("Hi, I'd like to upgrade my Kutchi Hub listing.")}`;

  const handleSelect = (planName: string, isFree: boolean) => {
    if (isFree) return; // Link handles this
    window.open(
      `https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent(`Hi, I want to upgrade to the ${planName} plan on Kutchi Hub.`)}`,
      "_blank",
    );
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Grow your business on Kutchi Hub</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Choose a plan that fits your business. Cancel anytime.
        </p>

        <p className="mt-4 text-sm font-medium text-[#ff6a00]">All plans are billed yearly</p>
      </div>

      <div className="mx-auto mt-10 grid max-w-6xl gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
        {plans.map((p) => {
          const isFree = Number(p.price_yearly) === 0;
          if (isFree) {
            return (
              <div key={p.id}>
                <Link to="/list-your-business" className="block">
                  <PlanCard plan={p} cycle={cycle} />
                </Link>
              </div>
            );
          }
          return <PlanCard key={p.id} plan={p} cycle={cycle} onSelect={() => handleSelect(p.name, false)} />;
        })}
      </div>

      {adSlots.length > 0 && (
        <div className="mt-16">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#ff6a00]/10 px-4 py-1.5 text-sm font-medium text-[#ff6a00]">
              <Megaphone className="h-4 w-4" /> Advertise with us
            </div>
            <h2 className="mt-3 text-2xl font-bold text-foreground sm:text-3xl">Reach thousands of Kutchi customers</h2>
            <p className="mt-2 text-muted-foreground">Sponsor banner slots, category pages, events, and popular searches.</p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {adSlots.map((slot) => (
              <Card key={slot.id} className="border-border">
                <CardContent className="p-5">
                  <h3 className="font-semibold text-foreground">{slot.name}</h3>
                  {slot.description && <p className="mt-1 text-sm text-muted-foreground">{slot.description}</p>}
                  <div className="mt-4 space-y-1">
                    <div className="text-lg font-bold text-[#ff6a00]">
                      ₹{Number(slot.price_monthly).toLocaleString("en-IN")}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">/ month</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      or ₹{Number(slot.price_yearly).toLocaleString("en-IN")} / year
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="mt-16 rounded-2xl border border-border bg-card p-8 text-center">
        <h2 className="text-2xl font-bold text-foreground">Need help choosing?</h2>
        <p className="mt-2 text-muted-foreground">Talk to us — we'll help pick the right plan for your business.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild className="bg-[#25D366] text-white hover:bg-[#1ea855]">
            <a href={contactHref} target="_blank" rel="noreferrer">
              <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={`tel:${CONTACT_PHONE.replace(/\s/g, "")}`}>
              <Phone className="mr-1.5 h-4 w-4" /> {CONTACT_PHONE}
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={`mailto:${CONTACT_EMAIL}`}>
              <Mail className="mr-1.5 h-4 w-4" /> {CONTACT_EMAIL}
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}