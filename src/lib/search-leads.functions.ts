import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerSupabaseClient } from "./businesses.server";
import { RateLimiter } from "./rate-limit";
import { PHONE_ERROR, normalizeIndianMobile } from "./phone";
import { cleanSourcePage, LEAD_NAME_ERROR, LEAD_NOT_READY_MESSAGE, LEAD_RATE_LIMIT_MESSAGE, type SearchLeadRow } from "./search-leads";

// A first guard in this server's memory: 5 requests per IP and 3 per mobile number in an hour. The database trigger
// (supabase/pending/search-leads) is the real limit: it holds across servers and also covers direct API calls.
const HOUR = 60 * 60_000;
const ipLimiter = new RateLimiter(5, HOUR);
const phoneLimiter = new RateLimiter(3, HOUR);

function clientIp(): string {
  try {
    const headers = getRequest().headers;
    return headers.get("x-forwarded-for")?.split(",")[0].trim() || headers.get("x-real-ip") || "unknown";
  } catch {
    return "unknown";
  }
}

const leadSchema = z.object({
  name: z.string().trim().min(2, LEAD_NAME_ERROR).max(80, LEAD_NAME_ERROR),
  phone: z.string().trim().max(30).refine((v) => normalizeIndianMobile(v) !== null, PHONE_ERROR),
  categoryId: z.string().uuid().nullable().optional(),
  city: z.string().trim().max(80).optional(),
  sourcePage: z.string().max(400).optional(),
  consent: z.literal(true, { message: "Please tick the box so our team may contact you" }),
  // A hidden field real visitors never fill in: a bot that fills every field fills this one too.
  website: z.string().max(200).optional(),
});

/** The table is not there yet (supabase/pending/search-leads not applied). */
const isMissingTable = (e: { code?: string; message?: string }) =>
  e.code === "42P01" || e.code === "PGRST205" || (/search_leads/i.test(e.message ?? "") && /does not exist|schema cache|not find/i.test(e.message ?? ""));

/**
 * The public "Get the list of top <category> - free" form. Anyone may send it (no sign-in). Saves one row in search_leads
 * (the database lets everyone INSERT and only admins read). Returns { ok: true } also for a repeated tap on the same request.
 */
export const submitSearchLead = createServerFn({ method: "POST" })
  .inputValidator((input) => leadSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    // A bot filled the hidden field: say "thanks" and save nothing.
    if (data.website && data.website.trim()) return { ok: true };
    const phone = normalizeIndianMobile(data.phone)!;
    const ip = clientIp();
    if (!ipLimiter.take(ip) || !phoneLimiter.take(phone)) throw new Error(LEAD_RATE_LIMIT_MESSAGE);

    // Only a hash of the IP is stored (enough to count requests, not to read the address back).
    const { createHash } = await import("node:crypto");
    const ipHash = ip === "unknown" ? null : createHash("sha256").update(`kh-search-leads:${ip}`).digest("hex");

    // The table is new and not in the generated types yet.
    const supabase = createServerSupabaseClient() as unknown as {
      from: (t: string) => { insert: (row: Record<string, unknown>) => Promise<{ error: { code?: string; message?: string } | null }> };
    };
    const { error } = await supabase.from("search_leads").insert({
      name: data.name.replace(/\s+/g, " "),
      phone,
      category_id: data.categoryId ?? null,
      city: data.city || null,
      source_page: cleanSourcePage(data.sourcePage),
      consent: true,
      ip_hash: ipHash,
    });
    if (error) {
      if (/search_leads_rate_limited/.test(error.message ?? "")) throw new Error(LEAD_RATE_LIMIT_MESSAGE);
      // Table missing (SQL not applied yet) or any other refusal: the visitor is sent to call / WhatsApp instead of seeing a database error.
      throw new Error(LEAD_NOT_READY_MESSAGE);
    }
    return { ok: true };
  });

async function requireAdmin(context: { supabase: ReturnType<typeof createServerSupabaseClient>; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!isAdmin) throw new Error("Unauthorized");
}

/** Admin: the latest search leads (newest first). `ready: false` while the table does not exist yet. */
export const adminListSearchLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ready: boolean; rows: SearchLeadRow[] }> => {
    await requireAdmin(context as never);
    const client = context.supabase as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          order: (c: string, o: { ascending: boolean }) => {
            limit: (n: number) => Promise<{
              data: Array<{
                id: string; name: string; phone: string; city: string | null; source_page: string | null; created_at: string;
                categories: { name: string } | null;
              }> | null;
              error: { code?: string; message?: string } | null;
            }>;
          };
        };
      };
    };
    const { data, error } = await client
      .from("search_leads")
      .select("id, name, phone, city, source_page, created_at, categories:category_id(name)")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) {
      if (isMissingTable(error)) return { ready: false, rows: [] };
      throw new Error(error.message);
    }
    return {
      ready: true,
      rows: (data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        categoryName: r.categories?.name ?? null,
        city: r.city,
        sourcePage: r.source_page,
        createdAt: r.created_at,
      })),
    };
  });
