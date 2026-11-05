import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCategory } from "@/lib/businesses.functions";
import { slugify } from "@/lib/slug";
import type { Tables } from "@/integrations/supabase/types";

/** Value of the "+ Add new category" entry in a category dropdown (never a real category id). */
export const ADD_CATEGORY_VALUE = "__add_new_category__";

/**
 * ADMIN ONLY: a small dialog for a new category name (English). The server checks admin and duplicates; a category that already
 * exists (same name in any case, or the same link name) is not created again - the existing one is handed back and `existed` is true.
 * It never touches the form behind it, so what was typed there stays. (No <form> here on purpose: a submit would bubble through the
 * portal into the form behind the dialog and save it.)
 * The categories table has no Gujarati / Hindi name columns, so there are no such fields.
 */
export function AddCategoryDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (category: Tables<"categories">, existed: boolean) => void;
}) {
  const addFn = useServerFn(createCategory);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setError("");
    }
  }, [open]);

  const clean = name.replace(/\s+/g, " ").trim();
  const slug = slugify(clean, 80);

  const save = async () => {
    if (busy) return;
    if (clean.length < 2) return setError("Enter the category name (at least 2 letters).");
    if (!slug) return setError("Write the name in English letters or numbers.");
    setBusy(true);
    setError("");
    try {
      const res = await addFn({ data: { name: clean } });
      onDone(res.category as Tables<"categories">, res.existed);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add the category.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
        <DialogHeader>
          <DialogTitle>Add new category</DialogTitle>
          <DialogDescription>It is saved right away and selected in the form. The icon can be changed later on the Categories page.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="new-category-name">Category name (English)</Label>
          <Input
            id="new-category-name"
            value={name}
            maxLength={80}
            autoComplete="off"
            autoFocus
            placeholder="e.g. Solar Panels"
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                void save();
              }
            }}
            aria-invalid={!!error}
          />
          {slug && !error && <p className="break-all text-xs text-muted-foreground">Link name: {slug}</p>}
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={busy || clean.length < 2} onClick={() => void save()}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save category
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
