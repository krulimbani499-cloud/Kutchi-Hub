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

const day = (iso: string | null | undefined) => (iso ? new Date(iso).toISOString().slice(0, 10) : undefined);
const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/categories", changefreq: "weekly", priority: "0.8" },
          { path: "/all-business", changefreq: "daily", priority: "0.8" },
          { path: "/about", changefreq: "monthly", priority: "0.5" },
          { path: "/privacy", changefreq: "yearly", priority: "0.3" },
          { path: "/delete-account", changefreq: "yearly", priority: "0.3" },
        ];

        try {
          const data = await getSitemapData();
          // Only pages that have at least one published business are listed (the data is built from the published businesses), each
          // with the date its content last changed (the newest business in it). Empty pages are noindex and not listed.
          for (const c of data.categories) entries.push({ path: `/category/${c.slug}`, changefreq: "weekly", priority: "0.8", lastmod: day(c.lastmod) });
          for (const c of data.cities) entries.push({ path: `/city/${c.slug}`, changefreq: "weekly", priority: "0.7", lastmod: day(c.lastmod) });
          for (const c of data.combos) entries.push({ path: `/city/${c.city}/category/${c.category}`, changefreq: "weekly", priority: "0.7", lastmod: day(c.lastmod) });
          for (const b of data.businesses) {
            entries.push({ path: `/business/${b.slug}`, changefreq: "weekly", priority: "0.6", lastmod: day(b.updated_at) });
          }
        } catch {
          // Fall through to static entries only
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${xml(`${BASE_URL}${e.path}`)}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const body = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(body, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
