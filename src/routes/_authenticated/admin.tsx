import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
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
  adminListPublishedBusinesses,
  adminSetVerified,
} from "@/lib/businesses.functions";
import { getDashboard } from "@/lib/businesses.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, ExternalLink, MapPin, Phone, Mail, Globe, Pencil, Trash2, Save, Plus, Image as ImageIcon, BadgeCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

const pendingQueryOptions = queryOptions({
  queryKey: ["admin", "pending-businesses"],
  queryFn: () => listPendingBusinesses(),
});

const categoriesAdminQueryOptions = queryOptions({
  queryKey: ["admin", "categories"],
  queryFn: () => getCategories(),
});

const bannersAdminQueryOptions = queryOptions({
  queryKey: ["admin", "banner-ads"],
  queryFn: () => adminListBannerAds(),
});

const verifyAdminQueryOptions = queryOptions({
  queryKey: ["admin", "verify-businesses"],
  queryFn: () => adminListPublishedBusinesses(),
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
    ]);
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

      <CategoriesAdmin />
      <BannersAdmin />
      <VerifyBusinessesAdmin />
    </div>
  );
}

function CategoriesAdmin() {
  const { data: categories, refetch } = useSuspenseQuery(categoriesAdminQueryOptions);
  const updateFn = useServerFn(adminUpdateCategory);
  const deleteFn = useServerFn(adminDeleteCategory);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState<{ name: string; slug: string; icon: string; color: string; display_order: number }>(
    { name: "", slug: "", icon: "", color: "", display_order: 0 },
  );

  const startEdit = (c: Tables<"categories">) => {
    setEditingId(c.id);
    setForm({
      name: c.name,
      slug: c.slug,
      icon: c.icon ?? "",
      color: c.color ?? "",
      display_order: c.display_order,
    });
  };

  const save = async (id: string) => {
    setBusy(id);
    try {
      await updateFn({
        data: {
          id,
          name: form.name,
          slug: form.slug,
          icon: form.icon,
          color: form.color,
          display_order: Number(form.display_order) || 0,
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
                        <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
                      </div>
                      <div>
                        <Label className="text-xs">Icon key</Label>
                        <Input
                          value={form.icon}
                          onChange={(e) => setForm({ ...form, icon: e.target.value })}
                          placeholder="utensils"
                        />
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
  title: string;
  subtitle: string;
  image_url: string;
  cta_label: string;
  cta_url: string;
  city: string;
  priority: number;
  active: boolean;
  end_at: string;
};

const emptyBanner: BannerFormState = {
  id: null,
  title: "",
  subtitle: "",
  image_url: "",
  cta_label: "",
  cta_url: "",
  city: "",
  priority: 0,
  active: true,
  end_at: "",
};

function BannersAdmin() {
  const { data: banners, refetch } = useSuspenseQuery(bannersAdminQueryOptions);
  const createFn = useServerFn(adminCreateBannerAd);
  const updateFn = useServerFn(adminUpdateBannerAd);
  const deleteFn = useServerFn(adminDeleteBannerAd);
  const [form, setForm] = useState<BannerFormState>(emptyBanner);
  const [busy, setBusy] = useState(false);

  const startEdit = (b: Tables<"banner_ads">) => {
    setForm({
      id: b.id,
      title: b.title,
      subtitle: b.subtitle ?? "",
      image_url: b.image_url,
      cta_label: b.cta_label ?? "",
      cta_url: b.cta_url ?? "",
      city: b.city,
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
      const payload = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        image_url: form.image_url.trim(),
        cta_label: form.cta_label.trim() || null,
        cta_url: form.cta_url.trim() || null,
        city: form.city.trim(),
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
              <Label className="text-xs">Image URL *</Label>
              <Input
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                placeholder="https://…"
              />
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

      <Card>
        <CardContent className="p-0">
          {banners.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No banners yet.</div>
          ) : (
            <ul className="divide-y divide-border">
              {banners.map((b) => (
                <li key={b.id} className="flex items-center gap-3 p-3">
                  <div className="h-14 w-24 shrink-0 overflow-hidden rounded-md bg-muted">
                    {b.image_url ? (
                      <img src={b.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <ImageIcon className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-foreground">{b.title}</span>
                      <Badge variant="outline" className="text-xs">{b.city}</Badge>
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

  const filtered = businesses.filter((b) => {
    if (!showAll && b.verified) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      b.name.toLowerCase().includes(q) ||
      (b.city ?? "").toLowerCase().includes(q) ||
      (b.categoryName ?? "").toLowerCase().includes(q)
    );
  });

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
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, city, category"
          className="max-w-sm"
        />
        <Button size="sm" variant={showAll ? "default" : "outline"} onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Showing all" : "Hiding verified"}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No businesses match.</p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.slice(0, 100).map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-foreground">{b.name}</span>
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
