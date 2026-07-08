import { useQuery } from "@tanstack/react-query";
import { getBusinessAnalytics } from "@/lib/leads.functions";
import { listBusinessDiscountClaims } from "@/lib/businesses.functions";
import { Eye, Phone, MessageSquare, Globe, Navigation, Share2, Inbox, Tag } from "lucide-react";

interface Props { businessId: string; businessName: string }

export function BusinessAnalyticsCard({ businessId, businessName }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", businessId],
    queryFn: () => getBusinessAnalytics({ data: { businessId } }),
  });

  const { data: claims } = useQuery({
    queryKey: ["discount-claims", businessId],
    queryFn: () => listBusinessDiscountClaims({ data: { businessId } }),
  });

  const t = data?.totals ?? { view: 0, call_click: 0, whatsapp_click: 0, website_click: 0, direction_click: 0, share_click: 0, enquiry_submit: 0 };

  const stats = [
    { label: "Profile Views", value: t.view, icon: Eye, color: "text-blue-600" },
    { label: "Calls", value: t.call_click, icon: Phone, color: "text-[#ff6a00]" },
    { label: "WhatsApp", value: t.whatsapp_click, icon: MessageSquare, color: "text-green-600" },
    { label: "Directions", value: t.direction_click, icon: Navigation, color: "text-purple-600" },
    { label: "Website", value: t.website_click, icon: Globe, color: "text-cyan-600" },
    { label: "Shares", value: t.share_click, icon: Share2, color: "text-slate-600" },
    { label: "Enquiries", value: t.enquiry_submit, icon: Inbox, color: "text-rose-600" },
    { label: "Coupon Claims", value: claims?.length ?? 0, icon: Tag, color: "text-[#ff6a00]" },
  ];

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-medium text-foreground">{businessName}</span>
        <span className="text-xs text-muted-foreground">Last 30 days</span>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {stats.map((s) => (
            <div key={s.label} className="rounded-md bg-muted/40 p-2 text-center">
              <s.icon className={`mx-auto mb-1 h-4 w-4 ${s.color}`} />
              <div className="text-lg font-bold text-foreground">{s.value}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}