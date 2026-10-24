// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // Run the server functions next to the database (Supabase ap-south-1, Mumbai). On Vercel this is also set in vercel.json;
  // having it here as well means a future deploy cannot silently fall back to the default region (iad1, ~250 ms per query).
  // (The config wrapper types only a few nitro options, but passes the whole object on to nitro, hence the cast.)
  nitro: { vercel: { functions: { regions: ["bom1"] } } } as unknown as { preset?: string },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
