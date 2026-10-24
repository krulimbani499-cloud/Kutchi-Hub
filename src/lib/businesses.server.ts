import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export function createServerSupabaseClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

/**
 * A business slug nobody else uses: `slug`, else `slug-2`, `slug-3`, ...
 * Looks at EVERY business (pending, rejected and archived too), which row-level security hides from a normal user,
 * so it uses the service client. `excludeId` is the business being edited (its own slug does not count as taken).
 * If the service client is not available it falls back to the caller's own client (sees less, still better than nothing).
 */
export async function uniqueBusinessSlug(
  slug: string,
  opts: { excludeId?: string | null; fallbackClient?: ReturnType<typeof createServerSupabaseClient> } = {},
): Promise<string> {
  const { pickUniqueSlug } = await import("./slug");
  let client: ReturnType<typeof createServerSupabaseClient> | null = null;
  try {
    client = (await import("@/integrations/supabase/client.server")).supabaseAdmin as unknown as ReturnType<typeof createServerSupabaseClient>;
  } catch {
    client = opts.fallbackClient ?? null;
  }
  if (!client) return slug;
  let query = client.from("businesses").select("slug").or(`slug.eq.${slug},slug.like.${slug}-%`).limit(2000);
  if (opts.excludeId) query = query.neq("id", opts.excludeId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return pickUniqueSlug(slug, new Set((data ?? []).map((r) => r.slug)));
}

/**
 * Which of these businesses have an ACTIVE Enterprise plan right now (a subscription that is "active", has started and has
 * not expired) AND are published. Read with the service client because visitors cannot read subscriptions. Evaluated at
 * read time, so a plan that expires drops out by itself. Throws if the service client is not available (callers decide
 * whether to fail closed).
 */
export async function activeEnterpriseBusinessIds(businessIds: readonly string[]): Promise<Set<string>> {
  const ids = [...new Set(businessIds)];
  if (ids.length === 0) return new Set();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date().toISOString();
  const { data: subs, error } = await supabaseAdmin
    .from("business_subscriptions")
    .select("business_id, plans:plan_id(slug)")
    .in("business_id", ids)
    .eq("status", "active")
    .lte("started_at", now)
    .or(`expires_at.is.null,expires_at.gt.${now}`);
  if (error) throw new Error(error.message);
  const enterprise = new Set(
    (subs ?? [])
      .filter((s) => (s as unknown as { plans: { slug: string } | null }).plans?.slug === "enterprise")
      .map((s) => s.business_id),
  );
  if (enterprise.size === 0) return enterprise;
  const { data: published, error: pubError } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .in("id", [...enterprise])
    .eq("status", "published");
  if (pubError) throw new Error(pubError.message);
  return new Set((published ?? []).map((b) => b.id));
}

/**
 * Sign-in accounts, looked up by e-mail or id. Uses the service client, so call it ONLY from admin-checked server functions.
 * (The auth API has no "find by e-mail", so the accounts are read page by page; the list is small.)
 */
async function eachAuthUserPage(visit: (users: Array<{ id: string; email?: string | null }>) => boolean | void): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const perPage = 1000;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const users = data?.users ?? [];
    if (visit(users) === true || users.length < perPage) return;
  }
}

export async function findAuthUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
  const wanted = email.trim().toLowerCase();
  let found: { id: string; email: string } | null = null;
  await eachAuthUserPage((users) => {
    const hit = users.find((u) => (u.email ?? "").toLowerCase() === wanted);
    if (hit) found = { id: hit.id, email: hit.email ?? wanted };
    return !!hit;
  });
  return found;
}

export async function authEmailsByIds(ids: readonly string[]): Promise<Map<string, string>> {
  const missing = new Set(ids);
  const out = new Map<string, string>();
  if (missing.size === 0) return out;
  await eachAuthUserPage((users) => {
    for (const u of users) {
      if (missing.has(u.id)) {
        if (u.email) out.set(u.id, u.email);
        missing.delete(u.id);
      }
    }
    return missing.size === 0;
  });
  return out;
}
