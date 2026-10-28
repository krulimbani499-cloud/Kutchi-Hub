import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  listPendingBusinesses,
  reviewBusinessSubmission,
  getCategories,
  adminUpdateCategory,
  adminDeleteCategory,
  adminListBannerAds,
  adminCreateBannerAd,
  adminUpdateBannerAd,
  adminDeleteBannerAd,
  adminBannerBusinessOptions,
  adminListPublishedBusinesses,
  adminSetVerified,
  adminListAuditLogs,
  adminGetStats,
} from "@/lib/businesses.functions";
import { adminListReports, adminUpdateReport } from "@/lib/reports.functions";
import { getDashboard } from "@/lib/businesses.functions";
import { EventsManager } from "@/components/admin/EventsManager";
import { PlansManager } from "@/components/admin/PlansManager";
import { AdSlotsManager } from "@/components/admin/AdSlotsManager";
import { SubscriptionsManager } from "@/components/admin/SubscriptionsManager";
import { PlansRevenueOverview } from "@/components/admin/PlansRevenueOverview";
import { BusinessesAdmin } from "@/components/admin/BusinessesAdmin";
import { SearchLeadsManager } from "@/components/admin/SearchLeadsManager";
import { BannerBusinessPicker } from "@/components/admin/BannerBusinessPicker";
import { BANNER_PLACEMENT_LABEL, BANNER_SLOT_WARNING_ABOVE, countLiveBannersBySlot, type BannerPlacement } from "@/lib/banner-rules";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, ExternalLink, MapPin, Phone, Mail, Globe, Pencil, Trash2, Save, Plus, Image as ImageIcon, BadgeCheck, Flag, Upload, Loader2, TriangleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import {
  BANNER_IMAGES_BUCKET,
  BANNER_IMAGE_MAX_BYTES,
  BANNER_IMAGE_WIDTH,
  BANNER_IMAGE_HEIGHT,
  BANNER_MOBILE_IMAGE_WIDTH,
  BANNER_MOBILE_IMAGE_HEIGHT,
} from "@/lib/banner-images";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { slugify, slugifyInput } from "@/lib/slug";
import { PUBLISH_GAP_LABEL, type PublishGap } from "@/lib/listing-completeness";
import { telHref, whatsappHref } from "@/lib/phone";
import { ListSearchInput } from "@/components/ListSearchInput";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { matchesSearch } from "@/lib/list-search";

const pendingQueryOptions = queryOptions({
  queryKey: ["admin", "pending-businesses"],
  queryFn: () => listPendingBusinesses(),
});

const categoriesAdminQueryOptions = queryOptions({
  queryKey: ["admin", "categories"],
  queryFn: () => getCategories(),
});

const bannerBusinessesQueryOptions = queryOptions({
  queryKey: ["admin", "banner-business-options"],
  queryFn: () => adminBannerBusinessOptions(),
});

const bannersAdminQueryOptions = queryOptions({
  queryKey: ["admin", "banner-ads"],
  queryFn: () => adminListBannerAds(),
});

const verifyAdminQueryOptions = queryOptions({
  queryKey: ["admin", "verify-businesses"],
  queryFn: () => adminListPublishedBusinesses(),
});

const auditLogsQueryOptions = queryOptions({
  queryKey: ["admin", "audit-logs"],
  queryFn: () => adminListAuditLogs(),
});

const statsQueryOptions = queryOptions({
  queryKey: ["admin", "stats"],
  queryFn: () => adminGetStats(),
});

const reportsQueryOptions = queryOptions({
  queryKey: ["admin", "reports"],
  queryFn: () => adminListReports(),
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
    await Promise.all([
      context.queryClient.ensureQueryData(pendingQueryOptions),
      context.queryClient.ensureQueryData(categoriesAdminQueryOptions),
      context.queryClient.ensureQueryData(bannersAdminQueryOptions),
      context.queryClient.ensureQueryData(verifyAdminQueryOptions),
      context.queryClient.ensureQueryData(auditLogsQueryOptions),
      context.queryClient.ensureQueryData(statsQueryOptions),
      context.queryClient.ensureQueryData(reportsQueryOptions),
    ]);
  },
  component: AdminPage,
});

function AdminPage() {
  const { data: pending, refetch } = useSuspenseQuery(pendingQueryOptions);
  const reviewFn = useServerFn(reviewBusinessSubmission);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState("overview");
  const [subsPlanFilter, setSubsPlanFilter] = useState<{ planId: string; planName: string } | null>(null);
  // Search for the pending list (name, city, category, slug, phone, business email).
  const [pendingText, setPendingText] = useState("");
  const pendingSearch = useDebouncedValue(pendingText, 150);
  const pendingShown = pending.filter((b) =>
    matchesSearch(pendingSearch, {
      text: [b.name, b.city, b.categoryName, b.slug, b.address, b.email],
      phones: [b.phone, b.phone_secondary],
    }),
  );

  const handleAction = async (id: string, action: "approve" | "reject") => {
    setBusyId(id);
    try {
      let result = await reviewFn({ data: { id, action } });
      if (result.needsConfirm) {
        // Missing category / address / photo: publish only after a deliberate second confirmation.
        const missing = result.gaps.map((g: PublishGap) => PUBLISH_GAP_LABEL[g]).join(", ");
        if (!confirm(`This business is missing: ${missing}.\n\nPublish it anyway?`)) return;
        result = await reviewFn({ data: { id, action, force: true } });
      }
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
          <p className="text-sm text-muted-foreground">Manage submissions, catalog, ads and security events.</p>
        </div>
        <Badge variant="secondary">{pending.length} pending</Badge>
      </div>

      <Tabs
        value={tab}
        onValueChange={(next) => {
          setTab(next);
          if (next !== "subs") setSubsPlanFilter(null);
        }}
        className="w-full"
      >
        <TabsList className="mb-6 flex h-auto w-full flex-wrap justify-start gap-1 bg-muted p-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pending">
            Pending Reviews
            {pending.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">{pending.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="verify">Verify Businesses</TabsTrigger>
          <TabsTrigger value="businesses">Businesses</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="banners">Banner Ads</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="adslots">Ad Slots</TabsTrigger>
          <TabsTrigger value="subs">Subscriptions</TabsTrigger>
          <TabsTrigger value="leads">Search leads</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <PlansRevenueOverview
            onOpenSubscriptions={(plan) => {
              setSubsPlanFilter({ planId: plan.id, planName: plan.name });
              setTab("subs");
            }}
            onOpenPending={() => setTab("pending")}
          />
          <OverviewAdmin />
        </TabsContent>

        <TabsContent value="pending" className="mt-0">
          {pending.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No pending submissions. All caught up!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <ListSearchInput value={pendingText} onChange={setPendingText} className="sm:max-w-sm" />
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {pendingShown.length} of {pending.length} pending
          </p>
          {pendingShown.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="font-medium text-foreground">Koi business nahi mila</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setPendingText("")}>
                  Clear
                </Button>
              </CardContent>
            </Card>
          )}
          {pendingShown.map((b) => (
            <Card key={b.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div className="min-w-0 flex-1">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                    <span className="min-w-0 break-words">{b.name}</span>
                    {b.categoryName ? <Badge variant="outline">{b.categoryName}</Badge> : null}
                    {b.quickLead && (
                      <Badge className="bg-amber-500 text-xs text-white hover:bg-amber-500">
                        {b.gaps.length > 0 ? "Quick lead - details incomplete" : "Quick lead"}
                      </Badge>
                    )}
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
                  {b.contactName ? (
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 shrink-0 opacity-0" />
                      <span>Contact: <span className="font-medium text-foreground">{b.contactName}</span></span>
                    </div>
                  ) : null}
                  {b.phone ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <a href={telHref(b.phone)} className="inline-flex items-center gap-2 font-medium text-foreground hover:underline">
                        <Phone className="h-4 w-4 shrink-0" />
                        {b.phone}
                      </a>
                      {whatsappHref(b.phone) && (
                        <a href={whatsappHref(b.phone)!} target="_blank" rel="noreferrer" className="text-xs font-medium text-green-700 hover:underline">
                          WhatsApp
                        </a>
                      )}
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
        </TabsContent>

        <TabsContent value="verify" className="mt-0">
          <VerifyBusinessesAdmin />
        </TabsContent>
        <TabsContent value="businesses" className="mt-0">
          <BusinessesAdmin />
        </TabsContent>
        <TabsContent value="categories" className="mt-0">
          <CategoriesAdmin />
        </TabsContent>
        <TabsContent value="banners" className="mt-0">
          <BannersAdmin />
        </TabsContent>
        <TabsContent value="reports" className="mt-0">
          <ReportsAdmin />
        </TabsContent>
        <TabsContent value="events" className="mt-0">
          <EventsManager />
        </TabsContent>
        <TabsContent value="plans" className="mt-0">
          <PlansManager />
        </TabsContent>
        <TabsContent value="adslots" className="mt-0">
          <AdSlotsManager />
        </TabsContent>
        <TabsContent value="subs" className="mt-0">
          <SubscriptionsManager planFilter={subsPlanFilter} onClearFilter={() => setSubsPlanFilter(null)} />
        </TabsContent>
        <TabsContent value="leads" className="mt-0">
          <SearchLeadsManager />
        </TabsContent>
        <TabsContent value="audit" className="mt-0">
          <AuditLogsAdmin />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CategoriesAdmin() {
  const { data: categories, refetch } = useSuspenseQuery(categoriesAdminQueryOptions);
  const updateFn = useServerFn(adminUpdateCategory);
  const deleteFn = useServerFn(adminDeleteCategory);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    slug: string;
    icon: string;
    icon_url: string;
    color: string;
    display_order: number;
    popular_image_url: string;
    popular_featured: boolean;
  }>(
    { name: "", slug: "", icon: "", icon_url: "", color: "", display_order: 0, popular_image_url: "", popular_featured: false },
  );

  const startEdit = (c: Tables<"categories">) => {
    setEditingId(c.id);
    setForm({
      name: c.name,
      slug: c.slug,
      icon: c.icon ?? "",
      icon_url: (c as unknown as { icon_url?: string | null }).icon_url ?? "",
      color: c.color ?? "",
      display_order: c.display_order,
      popular_image_url: (c as unknown as { popular_image_url?: string | null }).popular_image_url ?? "",
      popular_featured: Boolean((c as unknown as { popular_featured?: boolean | null }).popular_featured),
    });
  };

  const save = async (id: string) => {
    setBusy(id);
    try {
      await updateFn({
        data: {
          id,
          name: form.name,
          slug: slugify(form.slug, 80),
          icon: form.icon,
          icon_url: form.icon_url || null,
          color: form.color,
          display_order: Number(form.display_order) || 0,
          popular_image_url: form.popular_image_url || null,
          popular_featured: form.popular_featured,
        },
      });
      toast.success("Category updated");
      setEditingId(null);
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(null);
    }
  };

  const extractCategoryIconPath = (url: string): string | null => {
    const marker = "/category-icons/";
    const idx = url.indexOf(marker);
    return idx === -1 ? null : url.slice(idx + marker.length);
  };

  const handleIconFile = async (file: File, categoryId: string) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file (PNG/JPG/SVG)");
      return;
    }
    if (file.size > 500 * 1024) {
      toast.error("Icon too large. Please use an image under 500 KB.");
      return;
    }
    setUploadingIcon(true);
    try {
      const oldPath = form.icon_url ? extractCategoryIconPath(form.icon_url) : null;
      if (oldPath) {
        await supabase.storage.from("category-icons").remove([oldPath]);
      }
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${categoryId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("category-icons")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (upErr) throw new Error(upErr.message);
      const { data } = supabase.storage.from("category-icons").getPublicUrl(path);
      setForm((f) => ({ ...f, icon_url: data.publicUrl }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Icon upload failed");
    } finally {
      setUploadingIcon(false);
    }
  };

  const handlePopularImageFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file (PNG/JPG/WebP)");
      return;
    }
    if (file.size > 500 * 1024) {
      toast.error("Image too large. Please use one under 500 KB.");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
    setForm((f) => ({ ...f, popular_image_url: dataUrl }));
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete category "${name}"? This cannot be undone.`)) return;
    setBusy(id);
    try {
      await deleteFn({ data: { id } });
      toast.success("Category deleted");
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-10">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Popular Categories</h2>
          <p className="text-sm text-muted-foreground">Rename, re-order, restyle or remove categories.</p>
        </div>
        <Badge variant="secondary">{categories.length} total</Badge>
      </div>

      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {categories.map((c) => {
              const isEditing = editingId === c.id;
              return (
                <li key={c.id} className="p-4">
                  {isEditing ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      <div>
                        <Label className="text-xs">Name</Label>
                        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                      </div>
                      <div>
                        <Label className="text-xs">Slug</Label>
                        <Input
                          value={form.slug}
                          onChange={(e) => setForm({ ...form, slug: slugifyInput(e.target.value) })}
                          onBlur={() => setForm((f) => ({ ...f, slug: slugify(f.slug, 80) }))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Icon key</Label>
                        <Input
                          value={form.icon}
                          onChange={(e) => setForm({ ...form, icon: e.target.value })}
                          placeholder="utensils"
                        />
                      </div>
                      <div className="sm:col-span-2 lg:col-span-3">
                        <Label className="text-xs">Custom icon (PNG/SVG, max 500KB)</Label>
                        <div className="flex items-center gap-3">
                          {form.icon_url ? (
                            <img
                              src={form.icon_url}
                              alt="icon preview"
                              className="h-12 w-12 rounded-lg border border-border object-contain bg-white p-1"
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                              None
                            </div>
                          )}
                          <Input
                            type="file"
                            accept="image/png,image/jpeg,image/svg+xml,image/webp"
                            disabled={uploadingIcon}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleIconFile(f, c.id);
                              e.target.value = "";
                            }}
                          />
                          {uploadingIcon && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
                          {form.icon_url && !uploadingIcon ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setForm({ ...form, icon_url: "" })}
                            >
                              Remove
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Color</Label>
                        <Input
                          value={form.color}
                          onChange={(e) => setForm({ ...form, color: e.target.value })}
                          placeholder="#ff6a00"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Display order</Label>
                        <Input
                          type="number"
                          value={form.display_order}
                          onChange={(e) =>
                            setForm({ ...form, display_order: Number(e.target.value) || 0 })
                          }
                        />
                      </div>
                      <div className="sm:col-span-2 lg:col-span-5 rounded-lg border border-dashed border-border p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div>
                            <Label className="text-sm font-semibold">Popular Searches</Label>
                            <p className="text-xs text-muted-foreground">Show this category on the homepage Popular Searches strip with a custom image.</p>
                          </div>
                          <label className="flex items-center gap-2 text-xs">
                            <span>Featured</span>
                            <Switch
                              checked={form.popular_featured}
                              onCheckedChange={(v) => setForm((f) => ({ ...f, popular_featured: v }))}
                            />
                          </label>
                        </div>
                        <div className="flex items-center gap-3">
                          {form.popular_image_url ? (
                            <img
                              src={form.popular_image_url}
                              alt="popular preview"
                              className="h-16 w-24 rounded-md border border-border object-cover"
                            />
                          ) : (
                            <div className="flex h-16 w-24 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                              No image
                            </div>
                          )}
                          <div className="flex-1 space-y-2">
                            <Input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handlePopularImageFile(f);
                                e.target.value = "";
                              }}
                            />
                            <Input
                              placeholder="…or paste an image URL"
                              value={form.popular_image_url}
                              onChange={(e) => setForm((f) => ({ ...f, popular_image_url: e.target.value }))}
                            />
                          </div>
                          {form.popular_image_url ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setForm((f) => ({ ...f, popular_image_url: "" }))}
                            >
                              Remove
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
                        <Button size="sm" onClick={() => save(c.id)} disabled={busy === c.id}>
                          <Save className="mr-1.5 h-4 w-4" /> Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      {(c as unknown as { icon_url?: string | null }).icon_url ? (
                        <img
                          src={(c as unknown as { icon_url: string }).icon_url}
                          alt=""
                          className="h-10 w-10 rounded-lg border border-border object-contain bg-white p-1"
                        />
                      ) : null}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground">{c.name}</span>
                          <Badge variant="outline" className="text-xs">{c.slug}</Badge>
                          {c.icon ? <span className="text-xs text-muted-foreground">icon: {c.icon}</span> : null}
                          {c.color ? (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              color: <span className="inline-block h-3 w-3 rounded-full ring-1 ring-border" style={{ backgroundColor: c.color }} />
                            </span>
                          ) : null}
                          <span className="text-xs text-muted-foreground">order: {c.display_order}</span>
                          {(c as unknown as { popular_featured?: boolean | null }).popular_featured ? (
                            <Badge className="text-xs">Popular</Badge>
                          ) : null}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => startEdit(c)}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => remove(c.id, c.name)}
                        disabled={busy === c.id}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

type BannerFormState = {
  id: string | null;
  business_id: string;
  /** Name shown in the picker when the chosen business is not in the published list. */
  business_name: string;
  placement: BannerPlacement;
  show_all_cities: boolean;
  title: string;
  subtitle: string;
  image_url: string;
  mobile_image_url: string;
  cta_label: string;
  cta_url: string;
  city: string;
  category_id: string;
  priority: number;
  active: boolean;
  end_at: string;
};

const emptyBanner: BannerFormState = {
  id: null,
  business_id: "",
  business_name: "",
  placement: "home_top",
  show_all_cities: false,
  title: "",
  subtitle: "",
  image_url: "",
  mobile_image_url: "",
  cta_label: "",
  cta_url: "",
  city: "",
  category_id: "",
  priority: 0,
  active: true,
  end_at: "",
};

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image dimensions"));
    };
    img.src = url;
  });
}

function BannersAdmin() {
  const { data: banners, refetch } = useSuspenseQuery(bannersAdminQueryOptions);
  const { data: categories } = useSuspenseQuery(categoriesAdminQueryOptions);
  const { data: businessOptions = [] } = useQuery(bannerBusinessesQueryOptions);
  const createFn = useServerFn(adminCreateBannerAd);
  const updateFn = useServerFn(adminUpdateBannerAd);
  const deleteFn = useServerFn(adminDeleteBannerAd);
  const [form, setForm] = useState<BannerFormState>(emptyBanner);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadingMobile, setUploadingMobile] = useState(false);
  const [mobileUploadError, setMobileUploadError] = useState("");

  // Same bucket and flow for both images; only the required size differs (desktop 3:1, phone 2:1).
  const handleImageUpload = async (file: File | undefined, kind: "image" | "mobile" = "image") => {
    if (!file) return;
    const mobile = kind === "mobile";
    const setError = mobile ? setMobileUploadError : setUploadError;
    const setBusyFlag = mobile ? setUploadingMobile : setUploading;
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Please upload a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > BANNER_IMAGE_MAX_BYTES) {
      setError("Image is larger than 5MB. Please upload a smaller file.");
      return;
    }
    setBusyFlag(true);
    try {
      const { width, height } = await readImageDimensions(file);
      if (mobile) {
        // 2:1 (1200 × 600 recommended); any exact 2:1 image of at least 600px wide is accepted.
        if (width !== height * 2 || width < BANNER_MOBILE_IMAGE_WIDTH / 2) {
          setError(
            `Mobile image must be 2:1 (${BANNER_MOBILE_IMAGE_WIDTH} × ${BANNER_MOBILE_IMAGE_HEIGHT}px recommended). This image is ${width} × ${height}px.`,
          );
          return;
        }
      } else if (width !== BANNER_IMAGE_WIDTH || height !== BANNER_IMAGE_HEIGHT) {
        setError(
          `Image must be exactly ${BANNER_IMAGE_WIDTH} × ${BANNER_IMAGE_HEIGHT}px (3:1 ratio). This image is ${width} × ${height}px.`,
        );
        return;
      }
      const ext = file.name.split(".").pop() ?? "jpg";
      const key = `${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BANNER_IMAGES_BUCKET)
        .upload(key, file, { cacheControl: "3600", upsert: false });
      if (upErr) throw new Error(upErr.message);
      const { data } = supabase.storage.from(BANNER_IMAGES_BUCKET).getPublicUrl(key);
      setForm((f) => (mobile ? { ...f, mobile_image_url: data.publicUrl } : { ...f, image_url: data.publicUrl }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusyFlag(false);
    }
  };

  const startEdit = (b: Tables<"banner_ads">) => {
    const biz = (b as unknown as { business?: { name: string } | null }).business;
    setForm({
      id: b.id,
      business_id: b.business_id ?? "",
      business_name: biz?.name ?? "",
      placement: b.placement === "home_middle" ? "home_middle" : "home_top",
      show_all_cities: !!b.show_all_cities,
      title: b.title,
      subtitle: b.subtitle ?? "",
      image_url: b.image_url,
      mobile_image_url: b.mobile_image_url ?? "",
      cta_label: b.cta_label ?? "",
      cta_url: b.cta_url ?? "",
      city: b.city,
      category_id: b.category_id ?? "",
      priority: b.priority,
      active: b.active,
      end_at: b.end_at ? b.end_at.slice(0, 16) : "",
    });
  };

  const save = async () => {
    if (!form.title || !form.image_url || !form.city) {
      toast.error("Title, image URL and city are required");
      return;
    }
    setBusy(true);
    try {
      const homepage = !form.category_id;
      const payload = {
        business_id: form.business_id || null,
        placement: homepage ? form.placement : ("home_top" as const),
        show_all_cities: homepage && !!form.business_id && form.show_all_cities,
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        image_url: form.image_url.trim(),
        mobile_image_url: form.mobile_image_url.trim() || null,
        cta_label: form.cta_label.trim() || null,
        cta_url: form.cta_url.trim() || null,
        city: form.city.trim(),
        category_id: form.category_id || null,
        priority: Number(form.priority) || 0,
        active: form.active,
        end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
      };
      if (form.id) {
        await updateFn({ data: { id: form.id, ...payload } });
        toast.success("Banner updated");
      } else {
        await createFn({ data: payload });
        toast.success("Banner created");
      }
      setForm(emptyBanner);
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this banner?")) return;
    setBusy(true);
    try {
      await deleteFn({ data: { id } });
      toast.success("Banner deleted");
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  // Homepage banners only (category-page banners rotate on their own page).
  const slotCounts = countLiveBannersBySlot(banners.filter((b) => !b.category_id));
  const crowdedSlots = new Set(slotCounts.filter((c) => c.tooMany).map((c) => c.key));

  return (
    <div className="mt-10">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Marketing Banners</h2>
          <p className="text-sm text-muted-foreground">
            Paid sponsored banners shown on the homepage to visitors in the matching city.
          </p>
        </div>
        <Badge variant="secondary">{banners.length} total</Badge>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">
            {form.id ? "Edit banner" : "Add a new banner"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="text-xs">Business</Label>
              <BannerBusinessPicker
                options={businessOptions}
                value={form.business_id || null}
                selectedLabel={form.business_name || null}
                onPick={(o) =>
                  // Picking a business fills the title and city (both stay editable). The all-cities box needs Enterprise.
                  setForm((f) => ({
                    ...f,
                    business_id: o.id,
                    business_name: o.name,
                    title: o.name,
                    city: o.city || f.city,
                    show_all_cities: o.enterprise ? f.show_all_cities : false,
                  }))
                }
                onClear={() => setForm((f) => ({ ...f, business_id: "", business_name: "", show_all_cities: false }))}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Clicking the banner on the site opens this business page (unless a CTA URL below is set).
              </p>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Subtitle</Label>
              <Textarea
                rows={2}
                value={form.subtitle}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Banner image *</Label>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <label
                  className={`inline-flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted px-4 py-2 text-sm font-medium text-foreground ${
                    uploading ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-accent"
                  }`}
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  <span>{uploading ? "Uploading…" : form.image_url ? "Replace image" : "Upload image"}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      void handleImageUpload(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                <span className="text-xs text-muted-foreground">JPG, PNG or WebP · up to 5MB · exactly 1200 × 400px</span>
              </div>
              {uploadError && <p className="mt-1 text-xs text-destructive">{uploadError}</p>}
              {form.image_url && (
                <div className="mt-2 h-28 w-48 overflow-hidden rounded-md border border-border bg-muted">
                  <img src={form.image_url} alt="Banner preview" className="h-full w-full object-cover" />
                </div>
              )}
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">
                Mobile banner (1200 × 600 recommended) <span className="font-normal text-muted-foreground">— optional</span>
              </Label>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <label
                  className={`inline-flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted px-4 py-2 text-sm font-medium text-foreground ${
                    uploadingMobile ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-accent"
                  }`}
                >
                  {uploadingMobile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  <span>{uploadingMobile ? "Uploading…" : form.mobile_image_url ? "Replace mobile image" : "Upload mobile image"}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={uploadingMobile}
                    onChange={(e) => {
                      void handleImageUpload(e.target.files?.[0], "mobile");
                      e.target.value = "";
                    }}
                  />
                </label>
                <span className="text-xs text-muted-foreground">
                  JPG, PNG or WebP · up to 5MB · 2:1 · phones only; desktop keeps the main image
                </span>
              </div>
              {mobileUploadError && <p className="mt-1 text-xs text-destructive">{mobileUploadError}</p>}
              {form.mobile_image_url && (
                <div className="relative mt-2 h-24 w-48 overflow-hidden rounded-md border border-border bg-muted">
                  <img src={form.mobile_image_url} alt="Mobile banner preview" className="h-full w-full object-contain" />
                  <button
                    type="button"
                    aria-label="Remove mobile image"
                    onClick={() => setForm({ ...form, mobile_image_url: "" })}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs">CTA label</Label>
              <Input
                value={form.cta_label}
                onChange={(e) => setForm({ ...form, cta_label: e.target.value })}
                placeholder="Shop Now"
              />
            </div>
            <div>
              <Label className="text-xs">CTA URL</Label>
              <Input
                value={form.cta_url}
                onChange={(e) => setForm({ ...form, cta_url: e.target.value })}
                placeholder="https://…"
              />
            </div>
            <div>
              <Label className="text-xs">City *</Label>
              <Input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Ahmedabad"
              />
            </div>
            <div>
              <Label className="text-xs">Category (optional)</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              >
                <option value="">None — shows on homepage</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            {!form.category_id && (
              <>
                <div>
                  <Label className="text-xs">Placement</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={form.placement}
                    onChange={(e) => setForm({ ...form, placement: e.target.value as BannerPlacement })}
                  >
                    <option value="home_top">Top - under the search box</option>
                    <option value="home_middle">Middle - between Popular Categories and Nearby</option>
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">Top = Platinum ₹7,000 · Middle = Platinum ₹5,000 (3 years)</p>
                </div>
                <div>
                  {(() => {
                    const enterprise = businessOptions.find((o) => o.id === form.business_id)?.enterprise === true;
                    return (
                      <>
                        <label className={`flex items-center gap-2 pt-6 text-sm ${enterprise ? "text-foreground" : "text-muted-foreground"}`}>
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={form.show_all_cities && enterprise}
                            disabled={!enterprise}
                            onChange={(e) => setForm({ ...form, show_all_cities: e.target.checked })}
                          />
                          Show in all cities
                        </label>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {enterprise
                            ? "Also shown in every other city, in the Middle slot (as long as the Enterprise plan is active)."
                            : form.business_id
                              ? "This business does not have an active Enterprise plan."
                              : "Pick a business with an active Enterprise plan to enable this."}
                        </p>
                      </>
                    );
                  })()}
                </div>
              </>
            )}
            <div>
              <Label className="text-xs">Priority</Label>
              <Input
                type="number"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: Number(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label className="text-xs">Ends at</Label>
              <Input
                type="datetime-local"
                value={form.end_at}
                onChange={(e) => setForm({ ...form, end_at: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
              <Label className="text-sm">Active</Label>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={save} disabled={busy}>
              {form.id ? <Save className="mr-1.5 h-4 w-4" /> : <Plus className="mr-1.5 h-4 w-4" />}
              {form.id ? "Save changes" : "Create banner"}
            </Button>
            {form.id && (
              <Button variant="outline" onClick={() => setForm(emptyBanner)}>
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {slotCounts.length > 0 && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Live banners per city and slot (more than {BANNER_SLOT_WARNING_ABOVE} in one slot is too many to rotate)
            </p>
            <div className="flex flex-wrap gap-2">
              {slotCounts.map((c) => (
                <Badge
                  key={c.key}
                  variant={c.tooMany ? "destructive" : "outline"}
                  className="gap-1 text-xs font-normal"
                  title={c.tooMany ? `More than ${BANNER_SLOT_WARNING_ABOVE} banners rotate here` : undefined}
                >
                  {c.tooMany && <TriangleAlert className="h-3 w-3" />}
                  {c.city} · {BANNER_PLACEMENT_LABEL[c.placement]}: <strong>{c.count}</strong>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {banners.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No banners yet.</div>
          ) : (
            <ul className="divide-y divide-border">
              {banners.map((b) => (
                // Phones: the image + details on one line, Edit / Delete wrap underneath (the details column was ~70px wide and the badges ran under the buttons).
                <li key={b.id} className="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap">
                  <div className="h-14 w-24 shrink-0 overflow-hidden rounded-md bg-muted">
                    {b.image_url ? (
                      <img src={b.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <ImageIcon className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 basis-40">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-foreground">{b.title}</span>
                      <Badge variant="outline" className="text-xs">{b.city}</Badge>
                      {b.business?.name && <Badge variant="secondary" className="text-xs">{b.business.name}</Badge>}
                      {b.category_id ? (
                        <Badge variant="outline" className="text-xs">Category page</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">{BANNER_PLACEMENT_LABEL[b.placement === "home_middle" ? "home_middle" : "home_top"]}</Badge>
                      )}
                      {b.show_all_cities && <Badge className="bg-[#ff6a00] text-xs text-white hover:bg-[#ff6a00]">All cities</Badge>}
                      {b.shows_in_all_locations && <Badge data-shows-all-locations className="bg-emerald-600 text-xs text-white hover:bg-emerald-600">Shows in All locations</Badge>}
                      {!b.category_id && crowdedSlots.has(`${b.city.trim().toLowerCase()}|${b.placement === "home_middle" ? "home_middle" : "home_top"}`) && (
                        <Badge variant="destructive" className="gap-1 text-xs"><TriangleAlert className="h-3 w-3" />Crowded slot</Badge>
                      )}
                      {b.mobile_image_url && <Badge variant="outline" className="text-xs">Mobile image</Badge>}
                      {b.active ? (
                        <Badge className="bg-green-600 text-white hover:bg-green-600">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">priority: {b.priority}</span>
                    </div>
                    {b.subtitle && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{b.subtitle}</p>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => startEdit(b)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => remove(b.id)} disabled={busy}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
function VerifyBusinessesAdmin() {
  const { data: businesses, refetch } = useSuspenseQuery(verifyAdminQueryOptions);
  const setVerifiedFn = useServerFn(adminSetVerified);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const toggle = async (id: string, current: boolean) => {
    setBusy(id);
    try {
      await setVerifiedFn({ data: { id, verified: !current } });
      toast.success(!current ? "Marked verified" : "Verification removed");
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(null);
    }
  };

  const search = useDebouncedValue(query, 150);
  const filtered = businesses.filter(
    (b) =>
      (showAll || !b.verified) &&
      matchesSearch(search, {
        text: [b.name, b.city, b.categoryName, b.slug, b.email],
        phones: [b.phone, b.phoneSecondary],
      }),
  );

  return (
    <div className="mt-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-foreground">Verified Businesses</h2>
          <p className="text-sm text-muted-foreground">Toggle the blue tick badge on published businesses.</p>
        </div>
        <Badge variant="secondary">{businesses.filter((b) => b.verified).length} verified · {businesses.length} total</Badge>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ListSearchInput value={query} onChange={setQuery} className="sm:max-w-sm" />
        <Button size="sm" variant={showAll ? "default" : "outline"} onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Showing all" : "Hiding verified"}
        </Button>
      </div>
      <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
        {filtered.length} of {showAll ? businesses.length : businesses.filter((b) => !b.verified).length}{" "}
        {showAll ? "businesses" : "unverified businesses"}
      </p>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-6 text-center">
              <p className="font-medium text-foreground">Koi business nahi mila</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setQuery("")} disabled={!query}>
                Clear
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.slice(0, 100).map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 break-words font-medium text-foreground">{b.name}</span>
                      {b.verified && (
                        <Badge className="bg-blue-600 text-white hover:bg-blue-600">
                          <BadgeCheck className="mr-1 h-3 w-3" /> Verified
                        </Badge>
                      )}
                      {b.categoryName ? <Badge variant="outline" className="text-xs">{b.categoryName}</Badge> : null}
                      {b.city ? <span className="text-xs text-muted-foreground">· {b.city}</span> : null}
                    </div>
                  </div>
                  <Link
                    to="/business/$slug"
                    params={{ slug: b.slug }}
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                  >
                    View <ExternalLink className="h-3 w-3" />
                  </Link>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={b.verified}
                      disabled={busy === b.id}
                      onCheckedChange={() => toggle(b.id, b.verified)}
                    />
                    <Label className="text-xs text-muted-foreground">Verified</Label>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AuditLogsAdmin() {
  const { data: logs } = useSuspenseQuery(auditLogsQueryOptions);
  const [query, setQuery] = useState("");

  const filtered = logs.filter((l) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      l.event_type.toLowerCase().includes(q) ||
      (l.actor_id ?? "").toLowerCase().includes(q) ||
      (l.target_user_id ?? "").toLowerCase().includes(q) ||
      l.details.toLowerCase().includes(q)
    );
  });

  return (
    <div className="mt-10">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Audit Logs</h2>
          <p className="text-sm text-muted-foreground">
            Security-sensitive events — role grants and revocations. Latest 200.
          </p>
        </div>
        <Badge variant="secondary">{logs.length} events</Badge>
      </div>

      <div className="mb-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by event, user id, or details"
          className="max-w-sm"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No audit events yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((l) => {
                const isGrant = l.event_type === "role_granted";
                return (
                  <li key={l.id} className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={isGrant ? "bg-emerald-600 text-white hover:bg-emerald-600" : "bg-destructive text-destructive-foreground hover:bg-destructive"}>
                        {l.event_type}
                      </Badge>
                      <code className="text-xs text-muted-foreground">{l.details}</code>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {new Date(l.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                      <div>
                        <span className="font-medium">Actor:</span>{" "}
                        <code>{l.actor_id ?? "system"}</code>
                      </div>
                      <div>
                        <span className="font-medium">Target:</span>{" "}
                        <code>{l.target_user_id ?? "—"}</code>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function OverviewAdmin() {
  const { data: stats } = useSuspenseQuery(statsQueryOptions);
  const items = [
    { label: "Total Businesses", value: stats.totalBusinesses, color: "text-foreground" },
    { label: "Published", value: stats.publishedBusinesses, color: "text-emerald-600" },
    { label: "Pending Review", value: stats.pendingBusinesses, color: "text-amber-600" },
    { label: "Verified", value: stats.verifiedBusinesses, color: "text-blue-600" },
    { label: "Categories", value: stats.totalCategories, color: "text-foreground" },
    { label: "Reviews", value: stats.totalReviews, color: "text-foreground" },
    { label: "Discount Claims", value: stats.totalClaims, color: "text-[#ff6a00]" },
    { label: "Active Banners", value: stats.activeBanners, color: "text-foreground" },
    { label: "Assigned Roles", value: stats.totalRoles, color: "text-purple-600" },
  ];
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-foreground">Overview</h2>
        <p className="text-sm text-muted-foreground">Quick snapshot of the platform.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
              <p className={`mt-1 text-2xl font-extrabold tabular-nums ${s.color}`}>
                {s.value.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ReportsAdmin() {
  const { data: reports, refetch } = useSuspenseQuery(reportsQueryOptions);
  const updateFn = useServerFn(adminUpdateReport);
  const [busy, setBusy] = useState<string | null>(null);

  const setStatus = async (id: string, status: "open" | "reviewing" | "resolved" | "dismissed") => {
    setBusy(id);
    try {
      await updateFn({ data: { id, status } });
      toast.success("Report updated");
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(null);
    }
  };

  const statusColor = (s: string) =>
    s === "open" ? "destructive" : s === "reviewing" ? "default" : s === "resolved" ? "secondary" : "outline";

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <Flag className="h-5 w-5 text-destructive" /> Reports
          </h2>
          <p className="text-sm text-muted-foreground">User-submitted reports on businesses and reviews.</p>
        </div>
        <Badge variant="secondary">
          {reports.filter((r) => r.status === "open").length} open
        </Badge>
      </div>
      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No reports have been submitted yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="uppercase">{r.entity_type}</Badge>
                    <span className="font-mono text-xs text-muted-foreground">
                      {r.entity_id.slice(0, 8)}…
                    </span>
                    <Badge variant={statusColor(r.status) as never}>{r.status}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-foreground">
                  <span className="font-semibold">Reason: </span>
                  {r.reason}
                </p>
                {r.details && (
                  <p className="mt-1 text-sm text-muted-foreground">{r.details}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.status !== "reviewing" && (
                    <Button size="sm" variant="outline" disabled={busy === r.id}
                      onClick={() => setStatus(r.id, "reviewing")}>
                      Mark reviewing
                    </Button>
                  )}
                  {r.status !== "resolved" && (
                    <Button size="sm" variant="outline" className="text-emerald-600" disabled={busy === r.id}
                      onClick={() => setStatus(r.id, "resolved")}>
                      <Check className="mr-1 h-3.5 w-3.5" /> Resolve
                    </Button>
                  )}
                  {r.status !== "dismissed" && (
                    <Button size="sm" variant="ghost" className="text-muted-foreground" disabled={busy === r.id}
                      onClick={() => setStatus(r.id, "dismissed")}>
                      <X className="mr-1 h-3.5 w-3.5" /> Dismiss
                    </Button>
                  )}
                  {r.entity_type === "business" && (
                    <a
                      href={`/business/${r.entity_id}`}
                      className="ml-auto inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      View <ExternalLink className="h-3.5 w-3.5" />
                    </a>
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
