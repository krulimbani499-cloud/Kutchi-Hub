// The sender of the city notifications. SERVER ONLY.
//
// runDispatch() is the whole job and talks to the outside only through `deps`, so it can be tested without a database or Firebase.
// defaultDeps() connects it to Supabase (service role for the queue, the log and the subscriptions; the ANONYMOUS client to decide
// whether a business is visible: exactly what a visitor of the website can see) and to FCM (fcm.server.ts).
//
// One run (called every ~10 minutes by a scheduler):
//   1. old waiting rows expire (72 h);
//   2. in the quiet hours (21:00-08:00 India time) nothing else happens;
//   3. waiting businesses are announced one by one, but only if the PUBLIC can see them, at most 3 per city per day;
//      the rest are "held" for the evening summary (from 19:00): "5 more new businesses in Ahmedabad today", once a day per city.
// Without the Firebase service account (FIREBASE_SERVICE_ACCOUNT_JSON) it does nothing at all.
import { BASE_URL } from "./seo";
import {
  MAX_ATTEMPTS,
  cityKeyFor,
  cityLabelFor,
  inQuietHours,
  inSummaryWindow,
  istClock,
  planCity,
  singleText,
  summaryText,
  testText,
  type PushPlatform,
  type PushText,
} from "./city-push";
import { buildFcmMessage, readFcmConfig, sendFcm, sendToMany, type FcmResult, type SendSummary, type Target } from "./fcm.server";

export type QueueRow = { id: string; business_id: string; city: string | null; attempts: number };
export type PublicBusiness = { id: string; name: string; slug: string; city: string | null; category: string | null };
export type Subscriber = { id: string; token: string; platform: PushPlatform };
export type HeldRow = { id: string; business_id: string; city: string | null };
export type RowPatch = { status: "pending" | "held" | "sent" | "summarized" | "skipped" | "failed"; skip_reason?: string; sent_at?: string; city?: string; attempts?: number };
export type LogEntry = { city_key: string; day: string; kind: "single" | "summary"; business_id: string | null; item_count: number };

export interface DispatchDeps {
  /** Is a Firebase service account configured? */
  canSend(): boolean;
  now(): Date;
  nowMs(): number;
  /** Rows waiting longer than their 72 hours become 'expired'. Returns how many. */
  expireOld(nowIso: string): Promise<number>;
  claim(limit: number): Promise<QueueRow[]>;
  setStatus(id: string, patch: RowPatch): Promise<void>;
  /** The business as the PUBLIC sees it (anonymous client), or null when the public cannot see it. */
  publicBusiness(businessId: string): Promise<PublicBusiness | null>;
  singlesToday(cityKey: string, day: string): Promise<number>;
  subscribers(cityKey: string): Promise<Subscriber[]>;
  insertLog(entry: LogEntry): Promise<{ status: "ok"; id: string } | { status: "duplicate" } | { status: "error" }>;
  finishLog(id: string, sent: number, failed: number): Promise<void>;
  removeLog(id: string): Promise<void>;
  deleteSubscribers(ids: string[]): Promise<void>;
  heldRows(): Promise<HeldRow[]>;
  summaryDone(cityKey: string, day: string): Promise<boolean>;
  send(targets: Subscriber[], text: PushText): Promise<SendSummary>;
}

export type DispatchResult = {
  ok: boolean;
  skipped?: "not_configured" | "quiet_hours";
  expired: number;
  claimed: number;
  announced: number;
  held: number;
  summaries: number;
  notPublicYet: number;
  noSubscribers: number;
  retry: number;
  devicesReached: number;
  stoppedEarly?: "time" | "auth";
};

const CLAIM_LIMIT = 25;
const TIME_BUDGET_MS = 8_000;

export async function runDispatch(deps: DispatchDeps, budgetMs = TIME_BUDGET_MS): Promise<DispatchResult> {
  const res: DispatchResult = { ok: true, expired: 0, claimed: 0, announced: 0, held: 0, summaries: 0, notPublicYet: 0, noSubscribers: 0, retry: 0, devicesReached: 0 };
  if (!deps.canSend()) return { ...res, skipped: "not_configured" };

  const started = deps.nowMs();
  const outOfTime = () => deps.nowMs() - started > budgetMs;
  const now = deps.now();
  const clock = istClock(now);
  res.expired = await deps.expireOld(now.toISOString());
  if (inQuietHours(clock.hour)) return { ...res, skipped: "quiet_hours" };

  // ---- 1. the waiting businesses
  const rows = await deps.claim(CLAIM_LIMIT);
  res.claimed = rows.length;
  type Ready = { row: QueueRow; biz: PublicBusiness; key: string; label: string };
  const ready: Ready[] = [];
  for (const row of rows) {
    const biz = await deps.publicBusiness(row.business_id);
    if (!biz || !biz.city?.trim()) {
      // Not visible to the public (yet): e.g. a quick listing still waiting for its plan. Try again on the next run (the 72 hours end it).
      res.notPublicYet += 1;
      await deps.setStatus(row.id, { status: "pending", attempts: Math.max(0, row.attempts - 1) });
      continue;
    }
    ready.push({ row, biz, key: cityKeyFor(biz.city), label: cityLabelFor(biz.city) });
  }

  const byCity = new Map<string, Ready[]>();
  for (const r of ready) byCity.set(r.key, [...(byCity.get(r.key) ?? []), r]);

  const giveBack = async (items: Ready[], keepAttempt: boolean) => {
    for (const it of items) {
      const attempts = keepAttempt ? it.row.attempts : Math.max(0, it.row.attempts - 1);
      if (attempts >= MAX_ATTEMPTS) await deps.setStatus(it.row.id, { status: "failed", skip_reason: "send_failed", attempts });
      else await deps.setStatus(it.row.id, { status: "pending", attempts });
      res.retry += 1;
    }
  };

  cities: for (const [key, items] of byCity) {
    const sentToday = await deps.singlesToday(key, clock.day);
    const { send, hold } = planCity(items, sentToday);
    for (const it of hold) {
      await deps.setStatus(it.row.id, { status: "held", city: it.biz.city ?? undefined });
      res.held += 1;
    }
    if (send.length === 0) continue;

    const subs = await deps.subscribers(key);
    if (subs.length === 0) {
      for (const it of send) await deps.setStatus(it.row.id, { status: "skipped", skip_reason: "no_subscribers" });
      res.noSubscribers += send.length;
      continue;
    }
    for (let i = 0; i < send.length; i++) {
      const it = send[i];
      if (outOfTime()) {
        await giveBack(send.slice(i), false);
        res.stoppedEarly = "time";
        break cities;
      }
      const log = await deps.insertLog({ city_key: key, day: clock.day, kind: "single", business_id: it.biz.id, item_count: 1 });
      if (log.status === "duplicate") {
        await deps.setStatus(it.row.id, { status: "sent", sent_at: now.toISOString() });
        continue;
      }
      if (log.status === "error") {
        await giveBack([it], true);
        continue;
      }
      const out = await deps.send(subs, singleText(it.label, it.biz.name, it.biz.category, it.biz.slug));
      if (out.invalidIds.length > 0) await deps.deleteSubscribers(out.invalidIds);
      if (out.authFailed || (out.sent === 0 && out.failed > 0)) {
        await deps.removeLog(log.id);
        await giveBack([it], true);
        if (out.authFailed) {
          res.ok = false;
          res.stoppedEarly = "auth";
          await giveBack(send.slice(i + 1), false);
          break cities;
        }
        continue;
      }
      await deps.finishLog(log.id, out.sent, out.failed);
      await deps.setStatus(it.row.id, { status: "sent", sent_at: now.toISOString() });
      res.announced += 1;
      res.devicesReached += out.sent;
    }
  }

  // ---- 2. the evening summary of what was over the daily limit
  if (inSummaryWindow(clock.hour) && res.stoppedEarly === undefined) {
    const held = await deps.heldRows();
    const heldByCity = new Map<string, HeldRow[]>();
    for (const h of held) {
      if (!h.city?.trim()) continue;
      const key = cityKeyFor(h.city);
      heldByCity.set(key, [...(heldByCity.get(key) ?? []), h]);
    }
    for (const [key, group] of heldByCity) {
      if (outOfTime()) {
        res.stoppedEarly = "time";
        break;
      }
      if (await deps.summaryDone(key, clock.day)) continue; // one summary per city per day: the rest wait for tomorrow's
      const visible: HeldRow[] = [];
      for (const h of group) {
        if (await deps.publicBusiness(h.business_id)) visible.push(h);
        else await deps.setStatus(h.id, { status: "skipped", skip_reason: "not_public" });
      }
      if (visible.length === 0) continue;
      const subs = await deps.subscribers(key);
      if (subs.length === 0) {
        for (const h of visible) await deps.setStatus(h.id, { status: "skipped", skip_reason: "no_subscribers" });
        continue;
      }
      const log = await deps.insertLog({ city_key: key, day: clock.day, kind: "summary", business_id: null, item_count: visible.length });
      if (log.status !== "ok") continue;
      const out = await deps.send(subs, summaryText(cityLabelFor(group[0].city ?? key), visible.length, key));
      if (out.invalidIds.length > 0) await deps.deleteSubscribers(out.invalidIds);
      if (out.authFailed || (out.sent === 0 && out.failed > 0)) {
        await deps.removeLog(log.id);
        if (out.authFailed) {
          res.ok = false;
          res.stoppedEarly = "auth";
          break;
        }
        continue;
      }
      await deps.finishLog(log.id, out.sent, out.failed);
      for (const h of visible) await deps.setStatus(h.id, { status: "summarized" });
      res.summaries += 1;
      res.devicesReached += out.sent;
    }
  }
  return res;
}

// ------------------------------------------------------------------------------------------- the admin's test notification

export type TestPushResult =
  | { ok: true; platform: PushPlatform }
  | { ok: false; reason: "not_configured" | "unknown_token" | "dead_token" | "refused" | "busy" | "failed" };

export interface TestPushDeps {
  canSend(): boolean;
  /** The saved subscription of this token, or null. */
  findSubscription(token: string): Promise<Subscriber | null>;
  deleteSubscription(id: string): Promise<void>;
  send(sub: Subscriber, text: PushText): Promise<FcmResult>;
}

/**
 * One test notification to ONE device (the admin's own), right now. Not a business announcement: nothing is written to the queue or
 * the log, so it never counts in a city's daily limit. A dead token is removed (turn the alerts off and on again to get a new one).
 */
export async function sendTestPush(token: string, deps: TestPushDeps): Promise<TestPushResult> {
  if (!deps.canSend()) return { ok: false, reason: "not_configured" };
  const sub = await deps.findSubscription(token);
  if (!sub) return { ok: false, reason: "unknown_token" };
  const out = await deps.send(sub, testText());
  if (out.ok) return { ok: true, platform: sub.platform };
  if (out.kind === "invalid") {
    await deps.deleteSubscription(sub.id);
    return { ok: false, reason: "dead_token" };
  }
  return { ok: false, reason: out.kind === "auth" ? "refused" : out.kind === "transient" ? "busy" : "failed" };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function defaultTestDeps(): Promise<TestPushDeps> {
  const cfg = readFcmConfig();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as unknown as { from: (t: string) => any };
  return {
    canSend: () => cfg !== null,
    async findSubscription(token) {
      const { data, error } = await db.from("push_subscriptions").select("id, token, platform").eq("token", token).maybeSingle();
      return error || !data ? null : (data as Subscriber);
    },
    async deleteSubscription(id) {
      await db.from("push_subscriptions").delete().eq("id", id);
    },
    async send(sub, text) {
      if (!cfg) return { ok: false, kind: "other", status: 0 };
      return sendFcm(cfg, buildFcmMessage(sub.token, sub.platform, text, BASE_URL));
    },
  };
}

// ------------------------------------------------------------------------------------------- the real connections

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function defaultDeps(): Promise<DispatchDeps> {
  const cfg = readFcmConfig();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { createServerSupabaseClient } = await import("./businesses.server");
  const db = supabaseAdmin as unknown as { from: (t: string) => any; rpc: (f: string, a?: object) => any };
  const anon = createServerSupabaseClient() as unknown as { from: (t: string) => any };
  const fail = (what: string, e: unknown) => console.error(`[city-push] ${what} failed`, { code: (e as any)?.code, message: (e as any)?.message });

  return {
    canSend: () => cfg !== null,
    now: () => new Date(),
    nowMs: () => Date.now(),
    async expireOld(nowIso) {
      const { data, error } = await db
        .from("city_notify_queue")
        .update({ status: "expired" })
        .in("status", ["pending", "sending", "held"])
        .lt("expires_at", nowIso)
        .select("id");
      if (error) {
        fail("expire", error);
        return 0;
      }
      return (data ?? []).length;
    },
    async claim(limit) {
      const { data, error } = await db.rpc("claim_city_notify_rows", { p_limit: limit });
      if (error) {
        fail("claim", error);
        return [];
      }
      return (data ?? []) as QueueRow[];
    },
    async setStatus(id, patch) {
      const { error } = await db.from("city_notify_queue").update(patch).eq("id", id);
      if (error) fail("setStatus", error);
    },
    async publicBusiness(businessId) {
      // The same kind of question the business page asks, as an anonymous visitor: row-level security decides (published, and an
      // active plan if that rule is on in this database). Not visible = no row.
      const { data, error } = await anon
        .from("businesses")
        .select("id, name, slug, city, categories:category_id(name)")
        .eq("id", businessId)
        .eq("status", "published")
        .maybeSingle();
      if (error || !data) return null;
      const cat = (data as any).categories;
      return { id: data.id, name: data.name, slug: data.slug, city: data.city ?? null, category: (Array.isArray(cat) ? cat[0]?.name : cat?.name) ?? null };
    },
    async singlesToday(cityKey, day) {
      const { count, error } = await db.from("city_notify_log").select("id", { count: "exact", head: true }).eq("city_key", cityKey).eq("day", day).eq("kind", "single");
      if (error) {
        fail("singlesToday", error);
        return 99; // when in doubt, do not send
      }
      return count ?? 0;
    },
    async subscribers(cityKey) {
      const { data, error } = await db.from("push_subscriptions").select("id, token, platform").eq("city_key", cityKey).eq("enabled", true).limit(5000);
      if (error) {
        fail("subscribers", error);
        return [];
      }
      return (data ?? []) as Subscriber[];
    },
    async insertLog(entry) {
      const { data, error } = await db.from("city_notify_log").insert(entry).select("id").single();
      if (!error && data) return { status: "ok", id: data.id as string };
      if ((error as any)?.code === "23505") return { status: "duplicate" };
      fail("insertLog", error);
      return { status: "error" };
    },
    async finishLog(id, sent, failed) {
      const { error } = await db.from("city_notify_log").update({ sent, failed }).eq("id", id);
      if (error) fail("finishLog", error);
    },
    async removeLog(id) {
      const { error } = await db.from("city_notify_log").delete().eq("id", id);
      if (error) fail("removeLog", error);
    },
    async deleteSubscribers(ids) {
      const { error } = await db.from("push_subscriptions").delete().in("id", ids);
      if (error) fail("deleteSubscribers", error);
    },
    async heldRows() {
      const { data, error } = await db.from("city_notify_queue").select("id, business_id, city").eq("status", "held").order("created_at").limit(500);
      if (error) {
        fail("heldRows", error);
        return [];
      }
      return (data ?? []) as HeldRow[];
    },
    async summaryDone(cityKey, day) {
      const { count, error } = await db.from("city_notify_log").select("id", { count: "exact", head: true }).eq("city_key", cityKey).eq("day", day).eq("kind", "summary");
      if (error) {
        fail("summaryDone", error);
        return true; // when in doubt, do not send
      }
      return (count ?? 0) > 0;
    },
    async send(targets, text) {
      if (!cfg) return { sent: 0, failed: targets.length, invalidIds: [], authFailed: false };
      return sendToMany(cfg, targets as Target[], text, BASE_URL);
    },
  };
}
