import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { getSitemapData } from "@/lib/businesses.functions";
import { BASE_URL } from "@/lib/seo";

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
          { path: "/about", changefreq: "monthly", priority: "0.5" },
          { path: "/privacy", changefreq: "yearly", priority: "0.3" },
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

          // Only cities with at least one published business get landing pages
          // (data.cities is built from published businesses).
          const citySlugs = new Set<string>();
          for (const city of data.cities ?? []) {
            const s = toSlug(String(city));
            if (s) citySlugs.add(s);
          }
          for (const slug of citySlugs) {
            entries.push({ path: `/city/${slug}`, changefreq: "weekly", priority: "0.7" });
          }
          // Only city + category pairs that have at least one published business
          // (data.combos is built from published businesses).
          for (const { city, category } of data.combos ?? []) {
            entries.push({
              path: `/city/${city}/category/${category}`,
              changefreq: "weekly",
              priority: "0.6",
            });
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
