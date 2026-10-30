import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, MessageCircle } from "lucide-react";
import { BASE_URL, SITE_NAME, breadcrumbLd, ldScript } from "@/lib/seo";
import { pageMeta } from "@/lib/seo-landing";
import { CONTACT_EMAIL, SITE_PHONE_DISPLAY, siteWhatsappHref } from "@/lib/contact";
import { useT } from "@/lib/i18n";

// The public "Delete account URL" for Google Play (and the website): needs no sign-in, is server-rendered and can be indexed.
// What it says is what deleteMyAccount (src/lib/account.functions.ts) does and what the database does when the sign-in account goes
// (ON DELETE CASCADE / SET NULL): if one of them changes, this text must change with it.
const TITLE = "Delete your Kutchi Hub account";
const DESCRIPTION =
  "How to delete your Kutchi Hub account and personal data: in the app or on the website, or by email / WhatsApp if you cannot log in. What is deleted and what is kept.";
const DELETE_SUBJECT = "Delete my account";
const WHATSAPP_MESSAGE = "Delete my account";
const DELETED = ["del.d1", "del.d2", "del.d3", "del.d4", "del.d5", "del.d6", "del.d7", "del.d8"];
const KEPT = ["del.k1", "del.k2", "del.k3", "del.k4"];

export const Route = createFileRoute("/delete-account")({
  head: () => ({
    meta: pageMeta({ title: TITLE, description: DESCRIPTION, url: `${BASE_URL}/delete-account` }),
    links: [{ rel: "canonical", href: `${BASE_URL}/delete-account` }],
    scripts: [
      ldScript(
        breadcrumbLd([
          { name: "Home", url: "/" },
          { name: TITLE, url: "/delete-account" },
        ]),
      ),
    ],
  }),
  component: DeleteAccountPage,
});

const H2 = ({ children }: { children: React.ReactNode }) => <h2 className="mb-3 text-lg font-semibold text-foreground sm:text-xl">{children}</h2>;

/** A numbered list with big round numbers. */
function Steps({ keys, t }: { keys: string[]; t: (k: string) => string }) {
  return (
    <ol className="space-y-3">
      {keys.map((k, i) => (
        <li key={k} className="flex items-start gap-3">
          <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            {i + 1}
          </span>
          <span className="pt-1 text-base text-foreground">{t(k)}</span>
        </li>
      ))}
    </ol>
  );
}

function DeleteAccountPage() {
  const t = useT();
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <header className="mb-6">
        <h1 data-delete-title className="text-2xl font-extrabold leading-tight text-foreground sm:text-3xl">
          {t("del.title")}
        </h1>
        <p data-app-line className="mt-2 text-base font-semibold text-primary">
          {t("del.appLine")}
        </p>
        <p className="mt-3 text-muted-foreground">{t("del.intro")}</p>
      </header>

      <section aria-labelledby="del-steps" className="mb-6 space-y-4">
        <h2 id="del-steps" className="sr-only">
          {t("del.stepsTitle")}
        </h2>

        <div data-option-a className="rounded-2xl border-2 border-primary/50 bg-card p-5 shadow-sm sm:p-6">
          <H2>{t("del.optA")}</H2>
          <Steps keys={["del.a1", "del.a2", "del.a3", "del.a4", "del.a5"]} t={t} />
        </div>

        <div data-option-b className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <H2>{t("del.optB")}</H2>
          <Steps keys={["del.b1", "del.b2"]} t={t} />
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(DELETE_SUBJECT)}`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground hover:bg-muted"
            >
              <Mail className="h-4 w-4" /> {t("del.emailLabel")}: {CONTACT_EMAIL}
            </a>
            <a
              href={siteWhatsappHref(WHATSAPP_MESSAGE)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-emerald-600/40 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp: {SITE_PHONE_DISPLAY}
            </a>
          </div>
        </div>
      </section>

      <section data-what-deleted className="mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <H2>{t("del.deletedTitle")}</H2>
        <p className="mb-3 text-muted-foreground">{t("del.deletedIntro")}</p>
        <ul className="list-disc space-y-1.5 pl-5 text-foreground marker:text-primary">
          {DELETED.map((k) => (
            <li key={k}>{t(k)}</li>
          ))}
        </ul>
      </section>

      <section data-what-kept className="mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <H2>{t("del.keptTitle")}</H2>
        <ul className="list-disc space-y-2.5 pl-5 text-foreground marker:text-primary">
          {KEPT.map((k) => (
            <li key={k}>{t(k)}</li>
          ))}
        </ul>
      </section>

      <p className="text-sm text-muted-foreground">
        {t("del.privacyLead")}{" "}
        <Link to="/privacy" data-privacy-link className="font-medium text-primary underline">
          {t("del.privacy")}
        </Link>
        . {SITE_NAME} · {CONTACT_EMAIL}
      </p>
    </div>
  );
}
