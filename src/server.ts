import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { cacheControl, hasAuthCookie, mayEdgeCache } from "./lib/cache-policy";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

// Public pages (home, business, category, city ...) may be kept by the Vercel CDN for a short time, so a visitor or a crawler is
// served without running the page again. cache-policy.ts decides which addresses and which responses (a whitelist; logged-in
// pages, dashboard, admin, auth, API and server functions are never cached).
function withEdgeCache(request: Request, response: Response): Response {
  let pathname: string;
  try {
    pathname = new URL(request.url).pathname;
  } catch {
    return response;
  }
  const loggedInCookie = hasAuthCookie(request.headers.get("cookie"));
  const profile = mayEdgeCache({
    method: request.method,
    pathname,
    hasAuthorization: request.headers.has("authorization"),
    hasAuthCookie: loggedInCookie,
    status: response.status,
    contentType: response.headers.get("content-type") ?? "",
    setsCookie: response.headers.has("set-cookie"),
    cacheControl: response.headers.get("cache-control"),
  });
  if (!profile) {
    // A request with a login cookie / Authorization header is never stored for others, whatever the page.
    if ((loggedInCookie || request.headers.has("authorization")) && (response.headers.get("content-type") ?? "").toLowerCase().includes("text/html")) {
      const privateHeaders = new Headers(response.headers);
      privateHeaders.set("cache-control", "private, no-store");
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers: privateHeaders });
    }
    return response;
  }
  const headers = new Headers(response.headers);
  headers.set("cache-control", cacheControl(profile));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withEdgeCache(request, await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
