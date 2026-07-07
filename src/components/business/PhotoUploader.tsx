import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, Star, Upload } from "lucide-react";
import { BUSINESS_PHOTOS_BUCKET, getBusinessPhotoStorageKey } from "@/lib/business-photos";
import { BusinessPhotoImage } from "./BusinessPhotoImage";
import type { Tables } from "@/integrations/supabase/types";

interface PhotoUploaderProps {
  businessId: string;
  featuredImage: string | null;
  initialPhotos: Tables<"business_photos">[];
  onFeaturedChange?: (url: string) => void;
}

type PhotoRow = Tables<"business_photos">;

export function PhotoUploader({ businessId, featuredImage, initialPhotos, onFeaturedChange }: PhotoUploaderProps) {
  const [photos, setPhotos] = useState<PhotoRow[]>(initialPhotos);
  const [featured, setFeatured] = useState<string | null>(featuredImage);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    setPhotos(initialPhotos);
    setFeatured(featuredImage);
  }, [featuredImage, initialPhotos]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError("");
    setUploading(true);
    try {
      let displayOrder = photos.length;
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        if (file.size > 10 * 1024 * 1024) {
          setError(`${file.name} is larger than 10MB`);
          continue;
        }
        const ext = file.name.split(".").pop() ?? "jpg";
        const key = `${businessId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(BUSINESS_PHOTOS_BUCKET)
          .upload(key, file, { cacheControl: "3600", upsert: false });
        if (upErr) throw new Error(upErr.message);

        const { data: row, error: rowErr } = await supabase
          .from("business_photos")
          .insert({ business_id: businessId, url: key, display_order: displayOrder++ })
          .select()
          .single();
        if (rowErr) throw new Error(rowErr.message);
        setPhotos((p) => [...p, row]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (photo: PhotoRow) => {
    setError("");
    try {
      const key = getBusinessPhotoStorageKey(photo.url);
      if (key) {
        await supabase.storage.from(BUSINESS_PHOTOS_BUCKET).remove([key]);
      }
      await supabase.from("business_photos").delete().eq("id", photo.id);
      setPhotos((p) => p.filter((x) => x.id !== photo.id));
      if (featured === photo.url) {
        setFeatured(null);
        onFeaturedChange?.("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const setAsFeatured = async (photo: PhotoRow) => {
    setFeatured(photo.url);
    onFeaturedChange?.(photo.url);
    await supabase.from("businesses").update({ featured_image: photo.url }).eq("id", businessId);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          <span>{uploading ? "Uploading..." : "Upload photos"}</span>
          <input
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
            disabled={uploading}
          />
        </label>
        <p className="text-xs text-muted-foreground">JPG, PNG, WebP up to 10MB each</p>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative overflow-hidden rounded-lg border border-border">
              <BusinessPhotoImage src={photo.url} alt={photo.caption ?? "Business photo"} className="aspect-square w-full object-cover" />
              <div className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/70 via-transparent to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setAsFeatured(photo)}
                  className="h-7 px-2 text-xs"
                  title="Set as featured"
                >
                  <Star className={`h-3.5 w-3.5 ${featured === photo.url ? "fill-rating text-rating" : ""}`} />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => deletePhoto(photo)}
                  className="h-7 px-2 text-xs"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              {featured === photo.url && (
                <div className="absolute left-1 top-1 rounded bg-rating px-1.5 py-0.5 text-[10px] font-bold text-white">
                  Featured
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}