import { useEffect, useRef, useState } from "react";
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
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startPress = (photoId: string) => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {
      setActiveMenuId(photoId);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try { navigator.vibrate?.(30); } catch { /* noop */ }
      }
    }, 450);
  };
  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };
  useEffect(() => () => cancelPress(), []);

  useEffect(() => {
    setPhotos(initialPhotos);
    setFeatured(featuredImage);
  }, [featuredImage, initialPhotos]);

  const MAX_PHOTOS = 10;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError("");
    if (photos.length >= MAX_PHOTOS) {
      setError(`Photo limit reached (max ${MAX_PHOTOS}). Delete some photos first.`);
      return;
    }
    const remaining = MAX_PHOTOS - photos.length;
    const toUpload = Array.from(files).slice(0, remaining);
    if (files.length > remaining) {
      setError(`Only ${remaining} more photo${remaining === 1 ? "" : "s"} allowed. Uploading first ${remaining}.`);
    }
    setUploading(true);
    try {
      let displayOrder = photos.length;
      for (const file of toUpload) {
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

  const clearFeatured = async () => {
    setFeatured(null);
    onFeaturedChange?.("");
    await supabase.from("businesses").update({ featured_image: null }).eq("id", businessId);
  };

  return (
    <div className="space-y-4">
      {activeMenuId && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setActiveMenuId(null)}
          onContextMenu={(e) => { e.preventDefault(); setActiveMenuId(null); }}
        />
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label
          className={`inline-flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted px-4 py-2 text-sm font-medium text-foreground ${
            photos.length >= MAX_PHOTOS ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-accent"
          }`}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          <span>{uploading ? "Uploading..." : "Upload photos"}</span>
          <input
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
            disabled={uploading || photos.length >= MAX_PHOTOS}
          />
        </label>
        <p className="text-xs text-muted-foreground">
          JPG, PNG, WebP up to 10MB each · {photos.length}/{MAX_PHOTOS} photos
        </p>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {featured && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Star className="h-3.5 w-3.5 fill-rating text-rating" />
          <span>Featured image set. Tap another photo's star to change, or</span>
          <button
            type="button"
            onClick={clearFeatured}
            className="font-medium text-destructive underline underline-offset-2"
          >
            remove featured
          </button>
        </div>
      )}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="relative select-none overflow-hidden rounded-lg border border-border"
              onPointerDown={() => startPress(photo.id)}
              onPointerUp={cancelPress}
              onPointerLeave={cancelPress}
              onPointerCancel={cancelPress}
              onContextMenu={(e) => { e.preventDefault(); setActiveMenuId(photo.id); }}
            >
              <BusinessPhotoImage
                src={photo.url}
                alt={photo.caption ?? "Business photo"}
                className="pointer-events-none aspect-square w-full object-cover"
              />
              {featured === photo.url && (
                <div className="pointer-events-none absolute left-1 top-1 flex items-center gap-1 rounded bg-rating px-1.5 py-0.5 text-[10px] font-bold text-white">
                  <Star className="h-3 w-3 fill-white" />
                  Featured
                </div>
              )}
              {activeMenuId === photo.id && (
                <div className="absolute inset-0 z-50 flex flex-col items-stretch justify-center gap-2 bg-black/70 p-3">
                  {featured === photo.url ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={(e) => { e.stopPropagation(); clearFeatured(); setActiveMenuId(null); }}
                      className="h-8 gap-1 text-xs"
                    >
                      <Star className="h-3.5 w-3.5" /> Remove featured
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); setAsFeatured(photo); setActiveMenuId(null); }}
                      className="h-8 gap-1 text-xs"
                    >
                      <Star className="h-3.5 w-3.5 fill-rating text-rating" /> Set as featured
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={(e) => { e.stopPropagation(); deletePhoto(photo); setActiveMenuId(null); }}
                    className="h-8 gap-1 text-xs"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete photo
                  </Button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); }}
                    className="text-[11px] text-white/80 underline underline-offset-2"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}