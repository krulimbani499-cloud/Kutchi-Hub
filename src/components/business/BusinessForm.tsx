import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createBusiness, updateBusiness } from "@/lib/businesses.functions";
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
  featured_image: z.string().max(1000).optional(),
});

interface BusinessFormProps {
  categories: Tables<"categories">[];
  initial?: Tables<"businesses">;
}

export function BusinessForm({ categories, initial }: BusinessFormProps) {
  const navigate = useNavigate();
  const createFn = useServerFn(createBusiness);
  const updateFn = useServerFn(updateBusiness);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState("");

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
    featured_image: initial?.featured_image ?? "",
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
      const payload = businessFormSchema.parse(form);
      if (initial) {
        await updateFn({ data: { ...payload, id: initial.id } });
        setFormMessage("Business updated successfully.");
      } else {
        const result = await createFn({ data: payload });
        void navigate({ to: "/business/$slug", params: { slug: result.id } });
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
        <Select value={form.category_id} onValueChange={(value) => setForm((f) => ({ ...f, category_id: value }))}>
          <SelectTrigger id="category">
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      <div className="space-y-2">
        <Label htmlFor="featured_image">Featured image URL</Label>
        <Input id="featured_image" value={form.featured_image} onChange={(e) => setForm((f) => ({ ...f, featured_image: e.target.value }))} />
      </div>

      <Button type="submit" disabled={submitting} className="bg-primary text-primary-foreground">
        {submitting ? (initial ? "Updating..." : "Creating...") : initial ? "Update Business" : "Create Business"}
      </Button>
    </form>
  );
}
