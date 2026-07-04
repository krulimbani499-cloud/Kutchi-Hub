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
} from "@/lib/businesses.functions";
import { getDashboard } from "@/lib/businesses.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, ExternalLink, MapPin, Phone, Mail, Globe, Pencil, Trash2, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
                          placeholder="#f26c22"
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