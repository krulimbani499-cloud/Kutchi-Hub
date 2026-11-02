import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { timingSafeEqual } from "node:crypto";

// The sender of the city notifications. A scheduler calls it every ~10 minutes with the header  Authorization: Bearer <CRON_SECRET>
// (Vercel Cron adds that header by itself when the CRON_SECRET environment variable exists; Supabase pg_cron sends it from
// supabase/pending/city-push/04_schedule_pg_cron.sql). Without CRON_SECRET the address answers 503 and does nothing; without the
// Firebase service account the run does nothing either (see city-push.server.ts). Never cached, never public.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

function authorized(request: Request, secret: string): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const wanted = Buffer.from(`Bearer ${secret}`);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

async function handle(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return json({ ok: false, error: "not configured" }, 503);
  if (!authorized(request, secret)) return json({ ok: false, error: "unauthorized" }, 401);
  try {
    const { runDispatch, defaultDeps } = await import("@/lib/city-push.server");
    const result = await runDispatch(await defaultDeps());
    return json(result, result.ok ? 200 : 502);
  } catch (e) {
    console.error("[city-push] dispatch failed", (e as Error)?.message);
    return json({ ok: false, error: "failed" }, 500);
  }
}

export const Route = createFileRoute("/api/push/dispatch")({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});
