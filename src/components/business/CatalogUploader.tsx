import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";
import { BUSINESS_PHOTOS_BUCKET, SIGNED_BUSINESS_PHOTO_TTL_SECONDS, getBusinessPhotoStorageKey } from "@/lib/business-photos";

interface CatalogUploaderProps {
  businessId: string;
  initialUrl: string | null;
  initialName: string | null;
}

const MAX_SIZE = 20 * 1024 * 1024;

export function CatalogUploader({ businessId, initialUrl, initialName }: CatalogUploaderProps) {
  const [catalogUrl, setCatalogUrl] = useState<string | null>(initialUrl);
  const [catalogName, setCatalogName] = useState<string | null>(initialName);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setCatalogUrl(initialUrl);
    setCatalogName(initialName);
  }, [initialUrl, initialName]);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setError("");
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are allowed.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setError("PDF must be smaller than 20MB.");
      return;
    }
    setUploading(true);
    try {
      const key = `${businessId}/catalog-${crypto.randomUUID()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from(BUSINESS_PHOTOS_BUCKET)
        .upload(key, file, { cacheControl: "3600", upsert: false, contentType: "application/pdf" });
      if (upErr) throw new Error(upErr.message);

      const { error: rowErr } = await supabase
        .from("businesses")
        .update({ catalog_url: key, catalog_name: file.name })
        .eq("id", businessId);
      if (rowErr) throw new Error(rowErr.message);

      const oldKey = getBusinessPhotoStorageKey(catalogUrl);
      if (oldKey) await supabase.storage.from(BUSINESS_PHOTOS_BUCKET).remove([oldKey]);

      setCatalogUrl(key);
      setCatalogName(file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removeCatalog = async () => {
    setError("");
    try {
      const key = getBusinessPhotoStorageKey(catalogUrl);
      if (key) await supabase.storage.from(BUSINESS_PHOTOS_BUCKET).remove([key]);
      await supabase.from("businesses").update({ catalog_url: null, catalog_name: null }).eq("id", businessId);
      setCatalogUrl(null);
      setCatalogName(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const openCatalog = async () => {
    const key = getBusinessPhotoStorageKey(catalogUrl);
    if (!key) return;
    const { data, error: signErr } = await supabase.storage
      .from(BUSINESS_PHOTOS_BUCKET)
      .createSignedUrl(key, SIGNED_BUSINESS_PHOTO_TTL_SECONDS);
    if (signErr || !data) {
      setError("Could not open catalog.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label
          className={`inline-flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted px-4 py-2 text-sm font-medium text-foreground ${
            uploading ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-accent"
          }`}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          <span>{uploading ? "Uploading..." : catalogUrl ? "Replace catalog PDF" : "Upload catalog PDF"}</span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            disabled={uploading}
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <p className="text-xs text-muted-foreground">PDF only, up to 20MB.</p>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {catalogUrl && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background p-3">
          <FileText className="h-4 w-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-sm text-foreground">{catalogName ?? "Catalog.pdf"}</span>
          <Button type="button" size="sm" variant="secondary" className="h-8 text-xs" onClick={openCatalog}>
            View
          </Button>
          <Button type="button" size="sm" variant="destructive" className="h-8 gap-1 text-xs" onClick={removeCatalog}>
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </Button>
        </div>
      )}
    </div>
  );
}