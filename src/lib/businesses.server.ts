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
