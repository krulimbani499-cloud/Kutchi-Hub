import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listBusinessProducts,
  upsertBusinessProduct,
  deleteBusinessProduct,
} from "@/lib/products.functions";
import { supabase } from "@/integrations/supabase/client";
import { BUSINESS_PHOTOS_BUCKET } from "@/lib/business-photos";
import { BusinessPhotoImage } from "./BusinessPhotoImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, IndianRupee, Upload, X, Package } from "lucide-react";

interface Props {
  businessId: string;
}

type Product = Awaited<ReturnType<typeof listBusinessProducts>>[number];

async function uploadProductImage(businessId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const key = `${businessId}/products/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUSINESS_PHOTOS_BUCKET)
    .upload(key, file, { cacheControl: "3600", upsert: false });
  if (error) throw new Error(error.message);
  return key;
}

export function ProductsManager({ businessId }: Props) {
  const { data: products = [], refetch } = useQuery({
    queryKey: ["products", businessId],
    queryFn: () => listBusinessProducts({ data: { businessId } }),
  });
  const upsert = useServerFn(upsertBusinessProduct);
  const del = useServerFn(deleteBusinessProduct);

  const empty = {
    name: "",
    description: "",
    price: "",
    discountPrice: "",
    category: "",
    stock: "",
    inStock: true,
  };
  const [form, setForm] = useState(empty);
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handlePickImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError("");
    setUploading(true);
    try {
      const remaining = 8 - images.length;
      const picked = Array.from(files).slice(0, remaining);
      const uploaded: string[] = [];
      for (const f of picked) {
        if (!f.type.startsWith("image/")) continue;
        if (f.size > 10 * 1024 * 1024) {
          setError("Each image must be under 10MB.");
          continue;
        }
        uploaded.push(await uploadProductImage(businessId, f));
      }
      setImages((prev) => [...prev, ...uploaded]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.name.trim().length < 2) return;
    setBusy(true);
    try {
      await upsert({
        data: {
          businessId,
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          price: form.price ? Number(form.price) : null,
          discountPrice: form.discountPrice ? Number(form.discountPrice) : null,
          category: form.category.trim() || undefined,
          stock: form.stock ? Number(form.stock) : null,
          inStock: form.inStock,
          imageUrls: images,
        },
      });
      setForm(empty);
      setImages([]);
      await refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save product.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    await del({ data: { id } });
    await refetch();
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground">No products added yet.</p>
        ) : (
          products.map((p) => (
            <ProductRow key={p.id} product={p} onDelete={() => handleDelete(p.id)} />
          ))
        )}
      </div>

      <form onSubmit={handleAdd} className="space-y-3 rounded-lg border border-dashed border-border p-3">
        <div className="text-sm font-medium text-foreground">Add a product</div>
        <Input
          placeholder="Product name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          maxLength={120}
        />
        <Textarea
          placeholder="Description (optional)"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          maxLength={1000}
          rows={2}
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            min="0"
            step="1"
            placeholder="Price (₹)"
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
          />
          <Input
            type="number"
            min="0"
            step="1"
            placeholder="Discount price (₹)"
            value={form.discountPrice}
            onChange={(e) => setForm((f) => ({ ...f, discountPrice: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="Category (optional)"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            maxLength={120}
          />
          <Input
            type="number"
            min="0"
            step="1"
            placeholder="Stock qty (optional)"
            value={form.stock}
            onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.inStock}
            onChange={(e) => setForm((f) => ({ ...f, inStock: e.target.checked }))}
          />
          In stock / available
        </label>

        <div>
          <Label className="mb-1 block text-xs">Photos (up to 8)</Label>
          <div className="flex flex-wrap items-center gap-2">
            {images.map((key) => (
              <div key={key} className="relative h-16 w-16 overflow-hidden rounded-md border border-border">
                <BusinessPhotoImage src={key} alt="Product" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImages((prev) => prev.filter((k) => k !== key))}
                  className="absolute right-0.5 top-0.5 rounded-full bg-destructive p-0.5 text-white"
                  aria-label="Remove"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {images.length < 8 && (
              <label className="inline-flex h-16 w-16 cursor-pointer items-center justify-center rounded-md border border-dashed border-border text-muted-foreground hover:bg-muted">
                {uploading ? "…" : <Upload className="h-4 w-4" />}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void handlePickImages(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <Button
          type="submit"
          disabled={busy || uploading || form.name.trim().length < 2}
          className="bg-[#ff6a00] text-white hover:bg-[#e65a00]"
        >
          <Plus className="mr-1 h-4 w-4" /> {busy ? "Adding..." : "Add product"}
        </Button>
      </form>
    </div>
  );
}

function ProductRow({ product: p, onDelete }: { product: Product; onDelete?: () => void }) {
  const cover = p.image_urls?.[0];
  const hasDiscount = p.discount_price != null && p.price != null && p.discount_price < p.price;
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
      <div className="flex min-w-0 flex-1 gap-3">
        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border border-border bg-muted">
          <BusinessPhotoImage
            src={cover}
            alt={p.name}
            className="h-full w-full object-cover"
            fallback={<div className="flex h-full w-full items-center justify-center text-muted-foreground"><Package className="h-5 w-5" /></div>}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-medium text-foreground">{p.name}</span>
            {p.category && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {p.category}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
            {p.price != null && (
              <span className={`inline-flex items-center gap-0.5 text-sm font-semibold ${hasDiscount ? "text-muted-foreground line-through" : "text-[#ff6a00]"}`}>
                <IndianRupee className="h-3 w-3" />{p.price}
              </span>
            )}
            {hasDiscount && (
              <span className="inline-flex items-center gap-0.5 text-sm font-semibold text-[#ff6a00]">
                <IndianRupee className="h-3 w-3" />{p.discount_price}
              </span>
            )}
            {!p.in_stock ? (
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">Out of stock</span>
            ) : p.stock != null ? (
              <span className="text-xs text-muted-foreground">{p.stock} in stock</span>
            ) : null}
          </div>
          {p.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
        </div>
      </div>
      {onDelete && (
        <Button variant="ghost" size="icon" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      )}
    </div>
  );
}

export function ProductsDisplay({ products }: { products: Product[] }) {
  if (!products.length) return null;
  return (
    <div className="space-y-2">
      {products.map((p) => (
        <ProductRow key={p.id} product={p} />
      ))}
    </div>
  );
}