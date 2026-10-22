// What a listing still needs before it is worth showing publicly. Pure functions, used by the admin (publish warning,
// "details incomplete" badge) and by the owner dashboard (checklist after a plan is activated).

export type ListingFacts = {
  category_id?: string | null;
  address?: string | null;
  description?: string | null;
  hours?: unknown;
  featured_image?: string | null;
  /** Rows in business_photos. */
  photoCount?: number;
};

export type PublishGap = "category" | "address" | "photo";

const filled = (v: string | null | undefined) => !!v && v.trim().length > 0;
const hasHours = (h: unknown) => !!h && typeof h === "object" && Object.values(h as Record<string, unknown>).some((v) => typeof v === "string" && v.trim() !== "");
const hasPhoto = (f: ListingFacts) => (f.photoCount ?? 0) > 0 || filled(f.featured_image);

/** What the admin is warned about before publishing: no category, no address, no photo. */
export function publishGaps(f: ListingFacts): PublishGap[] {
  const gaps: PublishGap[] = [];
  if (!f.category_id) gaps.push("category");
  if (!filled(f.address)) gaps.push("address");
  if (!hasPhoto(f)) gaps.push("photo");
  return gaps;
}

export const PUBLISH_GAP_LABEL: Record<PublishGap, string> = {
  category: "category",
  address: "address",
  photo: "at least 1 photo",
};

export type ChecklistItem = { key: "category" | "address" | "hours" | "photos" | "description"; label: string; done: boolean };

/** The owner's "complete your business details" checklist. */
export function completionChecklist(f: ListingFacts): ChecklistItem[] {
  return [
    { key: "category", label: "Category", done: !!f.category_id },
    { key: "address", label: "Address", done: filled(f.address) },
    { key: "hours", label: "Opening hours", done: hasHours(f.hours) },
    { key: "photos", label: "At least 1 photo", done: hasPhoto(f) },
    { key: "description", label: "Description", done: filled(f.description) },
  ];
}
