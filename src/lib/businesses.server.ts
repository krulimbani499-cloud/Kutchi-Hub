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
