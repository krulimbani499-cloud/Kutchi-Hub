import { createFileRoute } from "@tanstack/react-router";
import { BASE_URL } from "@/lib/seo";
import { CONTACT_EMAIL } from "@/lib/contact";

const DESCRIPTION = "How to delete your Kutchi Hub account and personal data.";

export const Route = createFileRoute("/delete-account")({
  head: () => ({
    meta: [
      { title: "Delete Your Account — Kutchi Hub" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Delete Your Account — Kutchi Hub" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${BASE_URL}/delete-account` },
    ],
    links: [{ rel: "canonical", href: `${BASE_URL}/delete-account` }],
  }),
  component: DeleteAccountPage,
});

function DeleteAccountPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Delete your account</h1>
      <div className="rounded-2xl border border-border bg-card p-5 text-muted-foreground sm:p-6">
        <p>
          To delete your Kutchi Hub account and personal data, email{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Delete my account")}`}
            className="text-primary underline"
          >
            {CONTACT_EMAIL}
          </a>{" "}
          from your registered email address with the subject &lsquo;Delete my account&rsquo;. We will delete your
          account, profile, reviews, saved businesses and any business listings you own within 30 days.
        </p>
      </div>
    </div>
  );
}
