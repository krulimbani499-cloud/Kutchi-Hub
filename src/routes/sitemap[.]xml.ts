import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { getSitemapData } from "@/lib/businesses.functions";
import { INDIAN_CITIES } from "@/lib/cities";

const BASE_URL = "https://kutchi-hub.lovable.app";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
  lastmod?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/categories", changefreq: "weekly", priority: "0.8" },
          { path: "/list-your-business", changefreq: "monthly", priority: "0.6" },
        ];

        try {
          const data = await getSitemapData();
          const toSlug = (s: string) =>
            String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

          const categorySlugs = (data.categories ?? [])
            .map((c) => c.slug)
            .filter(Boolean) as string[];
          for (const slug of categorySlugs) {
            entries.push({ path: `/category/${slug}`, changefreq: "weekly", priority: "0.8" });
          }

          // Union of DB cities + full curated city list so every city gets an
          // indexable landing page + city×category combos, not just cities
          // that already have listings.
          const citySlugs = new Set<string>();
          for (const city of data.cities ?? []) {
            const s = toSlug(String(city));
            if (s) citySlugs.add(s);
          }
          for (const city of INDIAN_CITIES) {
            const s = toSlug(city);
            if (s) citySlugs.add(s);
          }
          for (const slug of citySlugs) {
            entries.push({ path: `/city/${slug}`, changefreq: "weekly", priority: "0.7" });
          }
          for (const citySlug of citySlugs) {
            for (const catSlug of categorySlugs) {
              entries.push({
                path: `/city/${citySlug}/category/${catSlug}`,
                changefreq: "weekly",
                priority: "0.6",
              });
            }
          }
          for (const b of data.businesses) {
            entries.push({
              path: `/business/${b.slug}`,
              changefreq: "weekly",
              priority: "0.6",
              lastmod: b.updated_at ? new Date(b.updated_at).toISOString().slice(0, 10) : undefined,
            });
          }
        } catch {
          // Fall through to static entries only
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
