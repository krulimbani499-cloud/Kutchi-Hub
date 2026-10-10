import { createFileRoute, Link } from "@tanstack/react-router";
import { BASE_URL } from "@/lib/seo";
import { CONTACT_EMAIL } from "@/lib/contact";

const DESCRIPTION =
  "How Kutchi Hub collects, uses and protects your information, and how to delete your account.";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Kutchi Hub" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Privacy Policy — Kutchi Hub" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${BASE_URL}/privacy` },
    ],
    links: [{ rel: "canonical", href: `${BASE_URL}/privacy` }],
  }),
  component: PrivacyPage,
});

const Email = () => (
  <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">
    {CONTACT_EMAIL}
  </a>
);

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mb-2 text-lg font-semibold text-foreground">{children}</h2>
);

function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold text-foreground">Privacy Policy</h1>
      <p className="mb-6 text-sm text-muted-foreground">Last updated: October 2026</p>
      <div className="space-y-6 rounded-2xl border border-border bg-card p-5 text-muted-foreground sm:p-6">
        <section>
          <H2>Who we are</H2>
          <p>
            Kutchi Hub (kutchihub.com) is operated by Krutarth Patel and Parth Patel, Kapadvanj, Gujarat, India.
            Contact: <Email />
          </p>
        </section>

        <section>
          <H2>What we collect</H2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="text-foreground">Account details:</strong> name, email address. Passwords are handled
              securely by our authentication provider; we never see them.
            </li>
            <li>
              <strong className="text-foreground">Business listing details you submit:</strong> business name, address,
              phone, WhatsApp, photos, Google Maps link, hours, description.
            </li>
            <li>
              <strong className="text-foreground">Reviews and saved businesses.</strong>
            </li>
            <li>
              <strong className="text-foreground">Location:</strong> only if you allow it, used to show nearby
              businesses.
            </li>
          </ul>
        </section>

        <section>
          <H2>How we use it</H2>
          <p>
            To run your account, show business listings, verify submitted businesses, and contact you about your
            listing.
          </p>
        </section>

        <section>
          <H2>Public information</H2>
          <p>Business listing details are shown publicly — that is the purpose of the directory.</p>
        </section>

        <section>
          <H2>Sharing</H2>
          <p>
            We do not sell your data. We use trusted service providers to run the platform: Supabase (database, login
            and file storage, servers in Mumbai, India), Vercel (website hosting), Zoho (email), and Google Maps (to
            find your city from your location, only if you allow location access). We may disclose data if required by
            law.
          </p>
        </section>

        <section>
          <H2>Deleting your data</H2>
          <p>
            You can delete your account anytime — see{" "}
            <Link to="/delete-account" className="text-primary underline">
              /delete-account
            </Link>
            . We delete your account and personal data within 30 days, except where the law requires us to keep it.
          </p>
        </section>

        <section>
          <H2>Children</H2>
          <p>Kutchi Hub is not intended for users under 18.</p>
        </section>

        <section>
          <H2>Changes</H2>
          <p>We may update this policy and will change the date above when we do.</p>
        </section>

        <section>
          <H2>Contact</H2>
          <p>
            <Email />
          </p>
        </section>
      </div>
    </div>
  );
}
