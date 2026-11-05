// Bringing an archived business back, written against a tiny database interface so the rules can be tested without a database.
// The admin check is NOT here: the server function checks it first. Only the STATUS changes: photos, services, reviews, owner and plan
// are other rows / other columns and are never touched by an archive or a restore.

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface RestoreDb {
  from(table: "businesses"): {
    select(columns: string): { eq(column: string, value: string): { maybeSingle(): PromiseLike<{ data: any; error: { message: string } | null }> } };
    update(values: Record<string, unknown>): { eq(column: string, value: string): any };
  };
}

export type RestoreTarget = "published" | "pending";

export const NOT_ARCHIVED_MESSAGE = "Only an archived business can be restored";

/**
 * Moves an ARCHIVED business to `target` ('published' or 'pending'). Throws when it is not archived (nothing is changed then, so two
 * admins clicking at once can not restore it twice or "restore" a live business). A business that was PUBLISHED before the archive
 * and comes back as 'pending' gets its city-notification switch turned off, so approving it later is not announced as a new business
 * (no notification ever goes out on the restore itself: that is the enqueue trigger's rule, a move out of 'archived' is not news).
 */
export async function restoreArchivedBusiness(
  db: RestoreDb,
  id: string,
  target: RestoreTarget,
  previousStatus: () => Promise<string | null>,
): Promise<{ name: string; previous: string | null }> {
  const { data: before, error: beforeError } = await db.from("businesses").select("name, status").eq("id", id).maybeSingle();
  if (beforeError) throw new Error(beforeError.message);
  if (!before || before.status !== "archived") throw new Error(NOT_ARCHIVED_MESSAGE);
  const previous = await previousStatus();
  const { data: rows, error } = await db.from("businesses").update({ status: target }).eq("id", id).eq("status", "archived").select("id");
  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) throw new Error(NOT_ARCHIVED_MESSAGE);
  if (target === "pending" && previous === "published") {
    // Best effort: the column exists only once supabase/pending/city-push has run.
    const { error: switchError } = await db.from("businesses").update({ notify_city: false }).eq("id", id);
    if (switchError) console.error("[restoreArchivedBusiness] notify_city not switched off", (switchError as { message?: string }).message);
  }
  return { name: before.name as string, previous };
}
