import { createFileRoute } from "@tanstack/react-router";
import { BASE_URL } from "@/lib/seo";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Us — Kutchi Hub" },
      { name: "description", content: "Learn about Kutchi Hub — a business directory built for the Kutch Kadva Patidar Samaj community by Krutarth Patel and Parth Patel from Kapadvanj, Gujarat." },
      { property: "og:title", content: "About Us — Kutchi Hub" },
      { property: "og:description", content: "Learn about Kutchi Hub — a business directory built for the Kutch Kadva Patidar Samaj community by Krutarth Patel and Parth Patel from Kapadvanj, Gujarat." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${BASE_URL}/about` },
    ],
    links: [{ rel: "canonical", href: `${BASE_URL}/about` }],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold text-foreground">About Kutchi Hub</h1>
      <div className="space-y-4 rounded-2xl border border-border bg-card p-5 text-muted-foreground sm:p-6">
        <p>
          Kutchi Hub is a business directory built for the Kutch Kadva Patidar Samaj community — by two Kutchi Patels.
        </p>
        <p>
          We are Krutarth Patel and Parth Patel, from Kapadvanj, Gujarat. We saw that Kutch Kadva Patidar Samaj
          businesses were scattered across India — with no single place where our community could find and support
          each other.
        </p>
        <p>So we built one.</p>
        <p>
          Kutchi Hub is a platform where Kutch Kadva Patidar Samaj businesses get verified listings, category
          banners, and direct visibility to customers within our samaj. Our goal is simple — when a Kutchi customer
          needs any product or service, they should find a Kutchi business first.
        </p>
        <p>We are just getting started. Join us.</p>
      </div>
    </div>
  );
}
