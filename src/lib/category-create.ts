// Adding a category: the name rules, the duplicate check, the daily limit and the insert, written against a tiny database interface
// so they can be tested without a database. Who may call it is decided by the server function (any signed-in person); the database
// does NOT let anybody insert directly (supabase/pending/category-admin-insert): the server function inserts with the service role
// AFTER these checks.
import { slugify } from "./slug";

type Row = { id: string; name: string; slug: string; display_order: number } & Record<string, unknown>;
type DbError = { code?: string; message: string } | null;
type Result<T> = { data: T; error: DbError; count?: number | null };

/** The few query methods used (the Supabase client has all of them). */
export interface CategoryDb {
  from(table: "categories"): {
    select(columns: string, options?: { count: "exact"; head: true }): CategoryQuery;
    insert(values: { name: string; slug: string; display_order: number; created_by?: string }): { select(columns: string): { single(): PromiseLike<Result<Row | null>> } };
  };
}
interface CategoryQuery extends PromiseLike<Result<Row[] | null>> {
  ilike(column: string, pattern: string): CategoryQuery;
  eq(column: string, value: string): CategoryQuery;
  gte(column: string, value: string): CategoryQuery;
  order(column: string, opts: { ascending: boolean }): CategoryQuery;
  limit(n: number): CategoryQuery;
}

export const CATEGORY_NAME_MIN = 2;
export const CATEGORY_NAME_MAX = 50;
/** A person who is not an admin may add this many new categories in 24 hours. */
export const CATEGORY_DAILY_LIMIT = 3;

/** The name as a LIKE pattern that matches only itself (case-insensitive): % _ and \ are escaped. */
export const exactNamePattern = (name: string) => name.replace(/[\\%_]/g, (c) => `\\${c}`);

/** "  Solar   Panels " -> "Solar Panels". */
export const cleanCategoryName = (name: string) => name.replace(/\s+/g, " ").trim();

export const CATEGORY_NAME_CHARS_MESSAGE = "Use only English letters, numbers, spaces, & and - in the name.";
export const CATEGORY_LIMIT_MESSAGE = `You can add up to ${CATEGORY_DAILY_LIMIT} new categories a day. Please choose an existing category, or try again tomorrow.`;
export const CATEGORY_RLS_MESSAGE = "The database does not allow adding categories yet. Run supabase/pending/category-admin-insert/01_migration.sql.";
export const CATEGORY_CREATOR_MESSAGE = "Adding categories needs a database update first (supabase/pending/category-creator). Please contact Kutchi Hub.";

/**
 * The one rule for a category name, used by the dialog (to tell the person at once) and by the server (the real check):
 * 2-50 characters of English letters, digits, spaces, & and -, with at least one letter or digit.
 */
export function validateCategoryName(raw: string): { ok: true; name: string; slug: string } | { ok: false; message: string } {
  const name = cleanCategoryName(raw);
  if (name.length < CATEGORY_NAME_MIN) return { ok: false, message: `Enter the category name (at least ${CATEGORY_NAME_MIN} letters).` };
  if (name.length > CATEGORY_NAME_MAX) return { ok: false, message: `The name can be at most ${CATEGORY_NAME_MAX} characters.` };
  if (!/^[A-Za-z0-9 &-]+$/.test(name)) return { ok: false, message: CATEGORY_NAME_CHARS_MESSAGE };
  const slug = slugify(name, 80);
  if (!slug) return { ok: false, message: "Write the category name in English letters or numbers." };
  return { ok: true, name, slug };
}

const isMissingColumn = (error: DbError) => !!error && (error.code === "42703" || error.code === "PGRST204" || /created_by/.test(error.message));

export async function createCategoryRecord(
  db: CategoryDb,
  rawName: string,
  who: { userId: string; isAdmin: boolean; now?: Date },
): Promise<{ category: Row; existed: boolean }> {
  const checked = validateCategoryName(rawName);
  if (!checked.ok) throw new Error(checked.message);
  const { name, slug } = checked;

  /** The category that already has this name (any case) or this slug, if any. */
  const findExisting = async () => {
    const [byName, bySlug] = await Promise.all([db.from("categories").select("*").ilike("name", exactNamePattern(name)).limit(1), db.from("categories").select("*").eq("slug", slug).limit(1)]);
    return byName.data?.[0] ?? bySlug.data?.[0] ?? null;
  };
  // An existing category is handed back without using up the daily limit.
  const existing = await findExisting();
  if (existing) return { category: existing, existed: true };

  // The daily limit (not for admins): how many categories this person created in the last 24 hours. Needs the created_by column.
  if (!who.isAdmin) {
    const since = new Date((who.now ?? new Date()).getTime() - 24 * 3600 * 1000).toISOString();
    const { count, error } = await db.from("categories").select("id", { count: "exact", head: true }).eq("created_by", who.userId).gte("created_at", since);
    if (error) throw new Error(isMissingColumn(error) ? CATEGORY_CREATOR_MESSAGE : "Could not add the category right now. Please try again.");
    if ((count ?? 0) >= CATEGORY_DAILY_LIMIT) throw new Error(CATEGORY_LIMIT_MESSAGE);
  }

  // Last in the list: one after the highest display_order now.
  const { data: last } = await db.from("categories").select("display_order").order("display_order", { ascending: false }).limit(1);
  const displayOrder = (last?.[0]?.display_order ?? 0) + 1;

  // No icon / image / colour is set: the site shows its default emoji for the name until an admin sets one on the Categories page.
  const insert = (withCreator: boolean) => db.from("categories").insert({ name, slug, display_order: displayOrder, ...(withCreator ? { created_by: who.userId } : {}) }).select("*").single();
  let { data: inserted, error } = await insert(true);
  // An admin can still add before the created_by column exists (nobody else can: see above).
  if (error && who.isAdmin && isMissingColumn(error)) ({ data: inserted, error } = await insert(false));
  if (error || !inserted) {
    // Two people adding the same name at the same moment: the second one gets the first one's category.
    if (error?.code === "23505") {
      const again = await findExisting();
      if (again) return { category: again, existed: true };
    }
    if (error && (error.code === "42501" || /row-level security|permission denied/i.test(error.message))) throw new Error(CATEGORY_RLS_MESSAGE);
    throw new Error(error?.message ?? "Could not add the category.");
  }
  return { category: inserted, existed: false };
}
