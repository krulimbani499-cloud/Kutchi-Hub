import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { RateLimiter } from "@/lib/rate-limit";
import { PUSH_PLATFORMS, cityKeyFor, cityLabelFor, isPlausibleToken } from "@/lib/city-push";

/**
 * Follow a city with this browser / phone (supabase/pending/city-push/01_migration.sql). Called by the web client after the person
 * pressed "Naye business ki khabar paayein" and allowed notifications. Nobody has to be signed in: the token itself is the key (long
 * and random, only this browser knows it), so changing the city or turning it off needs the token too.
 *
 * Every function here is best effort and never throws: when the table does not exist yet (SQL not run) or Firebase is not set up,
 * it answers { ok: false } and nothing else is affected.
 */

const registerLimiter = new RateLimiter(20); // per IP and minute: a guard against someone filling the table with rubbish

function clientIp(): string {
  try {
    const headers = getRequest().headers;
    return headers.get("x-forwarded-for")?.split(",")[0].trim() || headers.get("x-real-ip") || "unknown";
  } catch {
    return "unknown";
  }
}

const tokenSchema = z.string().trim().min(20).max(4096);
const citySchema = z.string().trim().min(2).max(80);

type Answer = { ok: true } | { ok: false; reason: "rate_limited" | "invalid" | "invalid_token" | "unknown_token" | "unavailable" };

/* eslint-disable @typescript-eslint/no-explicit-any */
async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as { from: (t: string) => any };
}

export const registerPushSubscription = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        token: tokenSchema,
        platform: z.enum(PUSH_PLATFORMS),
        city: citySchema,
        lang: z.enum(["en", "gu", "hi"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<Answer> => {
    try {
      if (!isPlausibleToken(data.token)) return { ok: false, reason: "invalid_token" };
      const cityKey = cityKeyFor(data.city);
      if (!cityKey || cityKey === "all") return { ok: false, reason: "invalid" };
      if (!registerLimiter.take(clientIp())) return { ok: false, reason: "rate_limited" };

      // Is it a real FCM token? FCM checks it without delivering anything. Skipped when Firebase is not set up on the server.
      const { readFcmConfig, sendFcm } = await import("@/lib/fcm.server");
      const cfg = readFcmConfig();
      if (cfg) {
        const check = await sendFcm(cfg, { token: data.token, data: { check: "1" } }, { validateOnly: true });
        if (!check.ok && check.kind === "invalid") return { ok: false, reason: "invalid_token" };
      }

      const now = new Date().toISOString();
      const db = await adminDb();
      const { error } = await db.from("push_subscriptions").upsert(
        { token: data.token, platform: data.platform, city_key: cityKey, city_label: cityLabelFor(data.city), lang: data.lang ?? null, enabled: true, failure_count: 0, updated_at: now, last_seen_at: now },
        { onConflict: "token" },
      );
      if (error) {
        console.error("[registerPushSubscription] failed", { code: error.code, message: error.message });
        return { ok: false, reason: "unavailable" };
      }
      return { ok: true };
    } catch (e) {
      console.error("[registerPushSubscription] failed", (e as Error)?.message);
      return { ok: false, reason: "unavailable" };
    }
  });

/** The person picked another city: the subscription moves to it. */
export const setPushCity = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: tokenSchema, city: citySchema }).parse(input))
  .handler(async ({ data }): Promise<Answer> => {
    try {
      if (!registerLimiter.take(clientIp())) return { ok: false, reason: "rate_limited" };
      const cityKey = cityKeyFor(data.city);
      if (!cityKey) return { ok: false, reason: "invalid" };
      const now = new Date().toISOString();
      const db = await adminDb();
      const { data: rows, error } = await db
        .from("push_subscriptions")
        .update({ city_key: cityKey, city_label: cityLabelFor(data.city), updated_at: now, last_seen_at: now })
        .eq("token", data.token)
        .select("id");
      if (error) return { ok: false, reason: "unavailable" };
      return (rows ?? []).length > 0 ? { ok: true } : { ok: false, reason: "unknown_token" };
    } catch {
      return { ok: false, reason: "unavailable" };
    }
  });

const testLimiter = new RateLimiter(6); // per admin and minute

/**
 * ADMIN ONLY: "Send test notification to my device". Sends "Kutchi Hub test" to the given token right now (it must be a saved
 * subscription), so nobody has to wait for the 10-minute sender. Not logged, not queued: never counts in a city's daily limit.
 */
export const adminSendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ token: tokenSchema }).parse(input))
  .handler(async ({ data, context }): Promise<import("@/lib/city-push.server").TestPushResult | { ok: false; reason: "rate_limited" }> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Unauthorized");
    if (!testLimiter.take(context.userId)) return { ok: false, reason: "rate_limited" };
    try {
      const { sendTestPush, defaultTestDeps } = await import("@/lib/city-push.server");
      return await sendTestPush(data.token, await defaultTestDeps());
    } catch (e) {
      console.error("[adminSendTestPush] failed", (e as Error)?.message);
      return { ok: false, reason: "failed" };
    }
  });

/** Notifications off: the subscription is deleted. */
export const unregisterPushSubscription = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: tokenSchema }).parse(input))
  .handler(async ({ data }): Promise<Answer> => {
    try {
      const db = await adminDb();
      const { error } = await db.from("push_subscriptions").delete().eq("token", data.token);
      return error ? { ok: false, reason: "unavailable" } : { ok: true };
    } catch {
      return { ok: false, reason: "unavailable" };
    }
  });
