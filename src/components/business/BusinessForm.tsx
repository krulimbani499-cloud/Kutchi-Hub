import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2, Plus, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createBusiness, updateBusiness, createCategory } from "@/lib/businesses.functions";
import { geocodeAddress } from "@/lib/maps.functions";
import { PhotoUploader } from "./PhotoUploader";
import { LocationPicker } from "./LocationPicker";
import { ServicesManager } from "./ServicesManager";
import { ProductsManager } from "./ProductsManager";
import type { Tables } from "@/integrations/supabase/types";

const businessFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(120),
  slug: z.string().min(2).max(120),
  category_id: z.string().uuid("Select a category"),
  description: z.string().max(2000).optional(),
  address: z.string().max(500).optional(),
  city: z.string().min(1, "City is required").max(120),
  state: z.string().max(120).optional(),
  pincode: z.string().max(20).optional(),
  phone: z.string().max(30).optional(),
  email: z.union([z.string().email().max(255), z.literal("")]).optional(),
  website: z.union([z.string().url().max(500), z.literal("")]).optional(),
  instagram_url: z.union([z.string().url().max(500), z.literal("")]).optional(),
  facebook_url: z.union([z.string().url().max(500), z.literal("")]).optional(),
  youtube_url: z.union([z.string().url().max(500), z.literal("")]).optional(),
  featured_image: z.string().max(1000).optional(),
  hours: z.record(z.string()).optional(),
  app_discount_percent: z
    .union([z.coerce.number().int().min(0).max(100), z.literal("")])
    .optional(),
  app_discount_label: z.string().max(80).optional(),
  app_discount_valid_until: z.string().max(20).optional(),
});

interface BusinessFormProps {
  categories: Tables<"categories">[];
  initial?: Tables<"businesses">;
  photos?: Tables<"business_photos">[];
}

export function BusinessForm({ categories, initial, photos = [] }: BusinessFormProps) {
  const navigate = useNavigate();
  const createFn = useServerFn(createBusiness);
  const updateFn = useServerFn(updateBusiness);
  const geocodeFn = useServerFn(geocodeAddress);
  const createCategoryFn = useServerFn(createCategory);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [categoryList, setCategoryList] = useState(categories);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({
    lat: initial?.latitude ?? null,
    lng: initial?.longitude ?? null,
  });
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: initial?.name ?? "",
    slug: initial?.slug ?? "",
    category_id: initial?.category_id ?? "",
    description: initial?.description ?? "",
    address: initial?.address ?? "",
    city: initial?.city ?? "",
    state: initial?.state ?? "",
    pincode: initial?.pincode ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    website: initial?.website ?? "",
    instagram_url: (initial as any)?.instagram_url ?? "",
    facebook_url: (initial as any)?.facebook_url ?? "",
    youtube_url: (initial as any)?.youtube_url ?? "",
    featured_image: initial?.featured_image ?? "",
    app_discount_percent:
      initial?.app_discount_percent != null ? String(initial.app_discount_percent) : "",
    app_discount_label: initial?.app_discount_label ?? "",
    app_discount_valid_until: initial?.app_discount_valid_until ?? "",
  });

  const [hours, setHours] = useState<Record<string, string>>(() => {
    const h = initial?.hours;
    if (h && typeof h === "object" && !Array.isArray(h)) {
      return h as Record<string, string>;
    }
    return {};
  });

  const slugify = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .substring(0, 120);

  const updateName = (value: string) => {
    const name = value;
    const slug = initial ? form.slug : slugify(name);
    setForm((f) => ({ ...f, name, slug }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setFormMessage("");
    setSubmitting(true);

    try {
      const normalized = {
        ...form,
        app_discount_percent:
          form.app_discount_percent === "" ? undefined : Number(form.app_discount_percent),
        app_discount_label: form.app_discount_label || undefined,
        app_discount_valid_until: form.app_discount_valid_until || undefined,
      };
      const payload = businessFormSchema.parse({ ...normalized, hours });
      if (initial) {
        await updateFn({ data: { ...payload, id: initial.id, latitude: coords.lat, longitude: coords.lng } });
        setFormMessage("Business updated successfully.");
      } else {
        const result = await createFn({ data: { ...payload, latitude: coords.lat, longitude: coords.lng } });
        // Upload pending image (if any) into the newly created business folder
        if (pendingFile) {
          try {
            const ext = pendingFile.name.split(".").pop() ?? "jpg";
            const key = `${result.id}/${crypto.randomUUID()}.${ext}`;
            const { error: upErr } = await supabase.storage
              .from("business-photos")
              .upload(key, pendingFile, { cacheControl: "3600", upsert: false });
            if (upErr) throw new Error(upErr.message);
            await supabase.from("business_photos").insert({ business_id: result.id, url: key, display_order: 0 });
            await supabase.from("businesses").update({ featured_image: key }).eq("id", result.id);
          } catch (uploadErr) {
            // Don't block navigation on photo upload failure; surface a soft message
            console.error("Photo upload failed after create:", uploadErr);
          }
        }
        void navigate({ to: "/business/$slug", params: { slug: result.slug } });
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        const map: Record<string, string> = {};
        for (const issue of err.issues) {
          map[issue.path.join(".")] = issue.message;
        }
        setErrors(map);
      } else if (err instanceof Error) {
        setFormMessage(err.message);
      } else {
        setFormMessage("Something went wrong.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePickFile = (file: File | null) => {
    if (!file) {
      setPendingFile(null);
      setPendingPreview(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setFormMessage("Please select an image file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFormMessage("Image must be smaller than 10MB.");
      return;
    }
    setPendingFile(file);
    setPendingPreview(URL.createObjectURL(file));
    setFormMessage("");
  };

  const handleGeocode = async () => {
    const composed = [form.address, form.city, form.state, form.pincode].filter(Boolean).join(", ");
    if (!composed) {
      setFormMessage("Enter an address or city first.");
      return;
    }
    setGeocoding(true);
    setFormMessage("");
    try {
      const res = await geocodeFn({ data: { address: composed } });
      if (!res.found) {
        setFormMessage("Could not find that address on the map.");
      } else {
        setCoords({ lat: res.latitude, lng: res.longitude });
        setFormMessage(`Location found: ${res.formatted_address}`);
      }
    } catch (err) {
      setFormMessage(err instanceof Error ? err.message : "Geocoding failed.");
    } finally {
      setGeocoding(false);
    }
  };

  // Auto-geocode ONLY when no pin has been set yet. Once the client pins a
  // location (drag/tap/GPS/geocode), we never move it automatically — even if
  // the address text is edited later. They must explicitly re-pin.
  const lastGeocodedRef = useRef<string>("");
  useEffect(() => {
    if (coords.lat != null && coords.lng != null) return;
    const composed = [form.address, form.city, form.state, form.pincode]
      .map((v) => v.trim())
      .filter(Boolean)
      .join(", ");
    if (!composed || !form.city.trim()) return;
    if (composed === lastGeocodedRef.current) return;
    const handle = setTimeout(async () => {
      lastGeocodedRef.current = composed;
      setGeocoding(true);
      try {
        const res = await geocodeFn({ data: { address: composed } });
        if (res.found) {
          setCoords({ lat: res.latitude, lng: res.longitude });
        }
      } catch {
        // silent — user can still click "Find on map"
      } finally {
        setGeocoding(false);
      }
    }, 900);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.address, form.city, form.state, form.pincode]);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {formMessage && (
        <div className={`rounded-lg px-4 py-3 text-sm ${formMessage.includes("success") ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}`}>
          {formMessage}
        </div>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Business name</Label>
          <Input id="name" value={form.name} onChange={(e) => updateName(e.target.value)} required />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input id="slug" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Select value={form.category_id || undefined} onValueChange={(value) => setForm((f) => ({ ...f, category_id: value }))}>
          <SelectTrigger id="category">
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            {categoryList.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!showAddCategory ? (
          <button
            type="button"
            onClick={() => setShowAddCategory(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <Plus className="h-3 w-3" /> Add new category
          </button>
        ) : (
          <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/40 p-3 sm:flex-row sm:items-center">
            <Input
              placeholder="New category name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="h-9"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={addingCategory || newCategoryName.trim().length < 2}
                onClick={async () => {
                  setAddingCategory(true);
                  setFormMessage("");
                  try {
                    const created = await createCategoryFn({ data: { name: newCategoryName.trim() } });
                    setCategoryList((list) =>
                      list.some((c) => c.id === created.id) ? list : [...list, created],
                    );
                    setForm((f) => ({ ...f, category_id: created.id }));
                    setNewCategoryName("");
                    setShowAddCategory(false);
                  } catch (err) {
                    setFormMessage(err instanceof Error ? err.message : "Could not add category.");
                  } finally {
                    setAddingCategory(false);
                  }
                }}
              >
                {addingCategory ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                Add
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowAddCategory(false);
                  setNewCategoryName("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
        {errors.category_id && <p className="text-xs text-destructive">{errors.category_id}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={4} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="address">Address</Label>
          <Input id="address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">City *</Label>
          <Input id="city" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} required />
          {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Input id="state" value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pincode">Pincode</Label>
          <Input id="pincode" value={form.pincode} onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))} />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="website">Website</Label>
        <Input id="website" value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
        {errors.website && <p className="text-xs text-destructive">{errors.website}</p>}
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <Label className="text-base">Social media links <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
        <p className="mb-3 text-xs text-muted-foreground">Add your profile URLs so customers can follow you.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="instagram_url" className="text-xs">Instagram</Label>
            <Input id="instagram_url" placeholder="https://instagram.com/..." value={form.instagram_url} onChange={(e) => setForm((f) => ({ ...f, instagram_url: e.target.value }))} />
            {errors.instagram_url && <p className="text-xs text-destructive">{errors.instagram_url}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="facebook_url" className="text-xs">Facebook</Label>
            <Input id="facebook_url" placeholder="https://facebook.com/..." value={form.facebook_url} onChange={(e) => setForm((f) => ({ ...f, facebook_url: e.target.value }))} />
            {errors.facebook_url && <p className="text-xs text-destructive">{errors.facebook_url}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="youtube_url" className="text-xs">YouTube</Label>
            <Input id="youtube_url" placeholder="https://youtube.com/@..." value={form.youtube_url} onChange={(e) => setForm((f) => ({ ...f, youtube_url: e.target.value }))} />
            {errors.youtube_url && <p className="text-xs text-destructive">{errors.youtube_url}</p>}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[#ff6a00]/30 bg-[#ff6a00]/5 p-4">
        <div className="mb-1 flex items-center gap-2">
          <Label className="text-base">App-exclusive discount</Label>
          <span className="rounded-full bg-[#ff6a00] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Optional
          </span>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Offer a special % OFF only for customers who show your listing on Kutchi Hub at your shop.
          Leave blank to skip.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="app_discount_percent">Discount %</Label>
            <Input
              id="app_discount_percent"
              type="number"
              min={0}
              max={100}
              placeholder="e.g. 10"
              value={form.app_discount_percent}
              onChange={(e) =>
                setForm((f) => ({ ...f, app_discount_percent: e.target.value }))
              }
            />
            {errors.app_discount_percent && (
              <p className="text-xs text-destructive">{errors.app_discount_percent}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="app_discount_label">Label (optional)</Label>
            <Input
              id="app_discount_label"
              placeholder="e.g. On total bill"
              value={form.app_discount_label}
              onChange={(e) =>
                setForm((f) => ({ ...f, app_discount_label: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="app_discount_valid_until">Valid until (optional)</Label>
            <Input
              id="app_discount_valid_until"
              type="date"
              value={form.app_discount_valid_until}
              onChange={(e) =>
                setForm((f) => ({ ...f, app_discount_valid_until: e.target.value }))
              }
            />
          </div>
        </div>
      </div>

      <HoursEditor hours={hours} onChange={setHours} />

      <div className="rounded-lg border border-border bg-muted/50 p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <Label>Map location</Label>
          <Button type="button" variant="outline" size="sm" onClick={handleGeocode} disabled={geocoding}>
            {geocoding ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <MapPin className="mr-2 h-3.5 w-3.5" />}
            Find on map
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {coords.lat != null && coords.lng != null
            ? `Pinned at ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} — drag the pin or tap "Find on map" to change it.`
            : "Type the address, city and pincode — the map will auto-locate."}
        </p>
        <div className="mt-3">
          <LocationPicker
            lat={coords.lat}
            lng={coords.lng}
            onChange={(lat, lng) => setCoords({ lat, lng })}
            onAddressResolved={(parts) => {
              // Prevent the auto-geocode effect from re-running on these values.
              const composed = [parts.address, parts.city ?? "", parts.state ?? "", parts.pincode ?? ""]
                .map((v) => v.trim())
                .filter(Boolean)
                .join(", ");
              lastGeocodedRef.current = composed;
              setForm((f) => ({
                ...f,
                address: parts.address || f.address,
                city: parts.city ?? f.city,
                state: parts.state ?? f.state,
                pincode: parts.pincode ?? f.pincode,
              }));
              setFormMessage("Address filled from map pin — edit if needed.");
            }}
          />
        </div>
      </div>

      {!initial && (
        <div className="space-y-2">
          <Label>Featured image</Label>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">
              <Upload className="h-4 w-4" />
              <span>{pendingFile ? "Change image" : "Upload image"}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handlePickFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {pendingPreview && (
              <div className="relative">
                <img src={pendingPreview} alt="Preview" className="h-20 w-20 rounded-md object-cover" />
                <button
                  type="button"
                  onClick={() => handlePickFile(null)}
                  className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-white shadow"
                  aria-label="Remove image"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">JPG, PNG or WebP. Up to 10MB.</p>
          </div>
        </div>
      )}
      {initial && (
        <div className="space-y-2">
          <Label>Photos</Label>
          <p className="text-xs text-muted-foreground">
            Upload photos below. Tap and hold on any photo to set it as the featured image or delete it.
          </p>
          <PhotoUploader
            businessId={initial.id}
            featuredImage={form.featured_image || null}
            initialPhotos={photos}
            onFeaturedChange={(url) => setForm((f) => ({ ...f, featured_image: url }))}
          />
        </div>
      )}

      {initial && (
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <Label className="mb-2 block">Services</Label>
          <p className="mb-3 text-xs text-muted-foreground">
            Add, edit or remove services you offer. Changes save instantly.
          </p>
          <ServicesManager businessId={initial.id} />
        </div>
      )}

      {initial && (
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <Label className="mb-2 block">Products</Label>
          <p className="mb-3 text-xs text-muted-foreground">
            Add products with photos, price and stock. Changes save instantly.
          </p>
          <ProductsManager businessId={initial.id} />
        </div>
      )}

      <Button type="submit" disabled={submitting} className="bg-primary text-primary-foreground">
        {submitting ? (initial ? "Updating..." : "Creating...") : initial ? "Update Business" : "Create Business"}
      </Button>
    </form>
  );
}

const DAYS: { key: string; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

function HoursEditor({
  hours,
  onChange,
}: {
  hours: Record<string, string>;
  onChange: (h: Record<string, string>) => void;
}) {
  const setDay = (key: string, value: string) => {
    const next = { ...hours };
    if (!value) delete next[key];
    else next[key] = value;
    onChange(next);
  };

  const applyToAll = () => {
    const first = hours[DAYS[0].key];
    if (!first) return;
    const next: Record<string, string> = {};
    for (const d of DAYS) next[d.key] = first;
    onChange(next);
  };

  return (
    <div className="rounded-lg border border-border bg-muted/50 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <Label>Business hours</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            e.g. <span className="font-mono">9:00 AM - 9:00 PM</span> or leave blank / type <span className="font-mono">Closed</span>.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={applyToAll}>
          Copy Mon to all
        </Button>
      </div>
      <div className="space-y-2">
        {DAYS.map((d) => {
          const val = hours[d.key] ?? "";
          const closed = val.trim().toLowerCase() === "closed";
          return (
            <div key={d.key} className="grid grid-cols-[90px_1fr_auto] items-center gap-2">
              <span className="text-sm font-medium text-foreground">{d.label}</span>
              <Input
                placeholder="9:00 AM - 9:00 PM"
                value={val}
                disabled={closed}
                onChange={(e) => setDay(d.key, e.target.value)}
                className="h-9"
              />
              <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={closed}
                  onChange={(e) => setDay(d.key, e.target.checked ? "Closed" : "")}
                />
                Closed
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
