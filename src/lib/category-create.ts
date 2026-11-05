// Adding a category: the name rules, the duplicate check and the insert, written against a tiny database interface so they can be
// tested without a database. The admin check is NOT here: the server function checks it before calling this.
import { slugify } from "./slug";

type Row = { id: string; name: string; slug: string; display_order: number } & Record<string, unknown>;
type DbError = { code?: string; message: string } | null;

/** The few query methods used (the Supabase client has all of them). */
export interface CategoryDb {
  from(table: "categories"): {
    select(columns: string): CategoryQuery;
    insert(values: { name: string; slug: string; display_order: number }): { select(columns: string): { single(): PromiseLike<{ data: Row | null; error: DbError }> } };
  };
}
interface CategoryQuery extends PromiseLike<{ data: Row[] | null; error: DbError }> {
  ilike(column: string, pattern: string): CategoryQuery;
  eq(column: string, value: string): CategoryQuery;
  order(column: string, opts: { ascending: boolean }): CategoryQuery;
  limit(n: number): CategoryQuery;
}

/** The name as a LIKE pattern that matches only itself (case-insensitive): % _ and \ are escaped. */
export const exactNamePattern = (name: string) => name.replace(/[\\%_]/g, (c) => `\\${c}`);

/** "  Solar   Panels " -> "Solar Panels". */
export const cleanCategoryName = (name: string) => name.replace(/\s+/g, " ").trim();

export const CATEGORY_RLS_MESSAGE = "The database does not allow adding categories yet. Run supabase/pending/category-admin-insert/01_migration.sql.";

export async function createCategoryRecord(db: CategoryDb, rawName: string): Promise<{ category: Row; existed: boolean }> {
  const name = cleanCategoryName(rawName);
  const slug = slugify(name, 80);
  if (name.length < 2) throw new Error("Enter the category name (at least 2 letters).");
  if (!slug) throw new Error("Write the category name in English letters or numbers.");

  /** The category that already has this name (any case) or this slug, if any. */
  const findExisting = async () => {
    const [byName, bySlug] = await Promise.all([db.from("categories").select("*").ilike("name", exactNamePattern(name)).limit(1), db.from("categories").select("*").eq("slug", slug).limit(1)]);
    return byName.data?.[0] ?? bySlug.data?.[0] ?? null;
  };
  const existing = await findExisting();
  if (existing) return { category: existing, existed: true };

  // Last in the list: one after the highest display_order now.
  const { data: last } = await db.from("categories").select("display_order").order("display_order", { ascending: false }).limit(1);
  const displayOrder = (last?.[0]?.display_order ?? 0) + 1;

  // No icon / image / colour is set: the site shows its default emoji for the name until an admin sets one on the Categories page.
  const { data: inserted, error } = await db.from("categories").insert({ name, slug, display_order: displayOrder }).select("*").single();
  if (error || !inserted) {
    // Two admins adding the same name at the same moment: the second one gets the first one's category.
    if (error?.code === "23505") {
      const again = await findExisting();
      if (again) return { category: again, existed: true };
    }
    if (error && (error.code === "42501" || /row-level security|permission denied/i.test(error.message))) throw new Error(CATEGORY_RLS_MESSAGE);
    throw new Error(error?.message ?? "Could not add the category.");
  }
  return { category: inserted, existed: false };
}
