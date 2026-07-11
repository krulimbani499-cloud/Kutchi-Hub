import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListEvents, upsertEvent, deleteEvent } from "@/lib/events.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Save, X, Calendar } from "lucide-react";
import { toast } from "sonner";

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
  location: string | null;
  city: string | null;
  image_url: string | null;
  category: string | null;
  contact: string | null;
  link_url: string | null;
  published: boolean;
};

type FormState = Partial<EventRow> & { title: string; start_at: string };

const emptyForm: FormState = {
  title: "",
  description: "",
  start_at: "",
  end_at: "",
  location: "",
  city: "",
  image_url: "",
  category: "",
  contact: "",
  link_url: "",
  published: true,
};

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventsManager() {
  const qc = useQueryClient();
  const { data: events = [], refetch } = useQuery({
    queryKey: ["admin", "events"],
    queryFn: () => adminListEvents(),
  });
  const upsertFn = useServerFn(upsertEvent);
  const deleteFn = useServerFn(deleteEvent);

  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const startNew = () => {
    setForm(emptyForm);
    setEditing("new");
  };

  const startEdit = (e: EventRow) => {
    setForm({
      ...e,
      description: e.description ?? "",
      start_at: toLocalInput(e.start_at),
      end_at: toLocalInput(e.end_at),
      location: e.location ?? "",
      city: e.city ?? "",
      image_url: e.image_url ?? "",
      category: e.category ?? "",
      contact: e.contact ?? "",
      link_url: e.link_url ?? "",
    });
    setEditing(e.id);
  };

  const cancel = () => {
    setEditing(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.start_at) {
      toast.error("Title and start date are required");
      return;
    }
    setSaving(true);
    try {
      await upsertFn({
        data: {
          id: editing === "new" ? undefined : (editing as string),
          title: form.title,
          description: form.description || null,
          startAt: form.start_at,
          endAt: form.end_at || null,
          location: form.location || null,
          city: form.city || null,
          imageUrl: form.image_url || null,
          category: form.category || null,
          contact: form.contact || null,
          linkUrl: form.link_url || null,
          published: form.published ?? true,
        },
      });
      toast.success(editing === "new" ? "Event created" : "Event updated");
      cancel();
      await refetch();
      qc.invalidateQueries({ queryKey: ["public-events"] });
      qc.invalidateQueries({ queryKey: ["upcoming-events"] });
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this event?")) return;
    try {
      await deleteFn({ data: { id } });
      toast.success("Deleted");
      await refetch();
      qc.invalidateQueries({ queryKey: ["public-events"] });
      qc.invalidateQueries({ queryKey: ["upcoming-events"] });
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Events</h2>
          <p className="text-sm text-muted-foreground">Only admins can add or edit events. Everyone can view.</p>
        </div>
        {editing === null && (
          <Button onClick={startNew}><Plus className="mr-1 h-4 w-4" /> New event</Button>
        )}
      </div>

      {editing !== null && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Title *</Label>
                <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <Label>Start date/time *</Label>
                <Input type="datetime-local" value={form.start_at} onChange={(e) => setForm((f) => ({ ...f, start_at: e.target.value }))} />
              </div>
              <div>
                <Label>End date/time</Label>
                <Input type="datetime-local" value={form.end_at ?? ""} onChange={(e) => setForm((f) => ({ ...f, end_at: e.target.value }))} />
              </div>
              <div>
                <Label>Location / venue</Label>
                <Input value={form.location ?? ""} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
              </div>
              <div>
                <Label>City</Label>
                <Input value={form.city ?? ""} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
              </div>
              <div>
                <Label>Category</Label>
                <Input placeholder="e.g. Fair, Festival, Cultural" value={form.category ?? ""} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
              </div>
              <div>
                <Label>Contact</Label>
                <Input placeholder="Phone number" value={form.contact ?? ""} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <Label>Image URL</Label>
                <Input placeholder="https://..." value={form.image_url ?? ""} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <Label>External link (registration, more info)</Label>
                <Input placeholder="https://..." value={form.link_url ?? ""} onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <Label>Description</Label>
                <Textarea rows={4} value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <Switch checked={form.published ?? true} onCheckedChange={(v) => setForm((f) => ({ ...f, published: v }))} />
                <Label>Published (visible to customers)</Label>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving}><Save className="mr-1 h-4 w-4" /> {saving ? "Saving..." : "Save"}</Button>
              <Button variant="outline" onClick={cancel}><X className="mr-1 h-4 w-4" /> Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {events.length === 0 && editing === null && (
          <Card><CardContent className="p-6 text-center text-muted-foreground">No events yet.</CardContent></Card>
        )}
        {events.map((e) => (
          <Card key={e.id}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-foreground">{e.title}</h3>
                  {!e.published && <Badge variant="outline">Draft</Badge>}
                  {e.category && <Badge variant="secondary">{e.category}</Badge>}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(e.start_at).toLocaleString()}
                  {e.city && ` · ${e.city}`}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => startEdit(e as EventRow)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="destructive" onClick={() => handleDelete(e.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}