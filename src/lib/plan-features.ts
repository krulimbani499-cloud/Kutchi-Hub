// ONE place that says which parts of a business profile a plan includes. Pure (no server imports), used by the edit form, the
// dashboard and the server functions, so the screen and the server always agree.
//
// Where the plan data lives: the `plans` table. Each plan row has numbers (max_photos, max_products, max_services, max_events, banner_ad_slots),
// switches (featured_listing, verified_badge, top_ranking, unlimited_leads, priority_support, analytics_access, allow_catalog) and a
// free-text `features` list that the pricing page prints. A business points at its plan with businesses.current_plan_id (kept up to
// date by a trigger whenever its subscription changes). The database itself enforces the numbers on INSERT (enforce_business_plan_limit,
// -1 = unlimited, 0 = none, no plan = the free defaults below).
//
// Silver today (live database): 5 photos, 0 products, 0 services, no catalog, verified badge, basic analytics, call / WhatsApp /
// directions buttons. So "Services" and "Products" are on when the plan allows more than 0 of them.

/** What the database trigger uses for a business that has no plan. */
export const FREE_PLAN_LIMITS = { photos: 5, products: 3, services: 3 } as const;

/** The plan that adds Services and Products (the lowest plan with a limit above 0). Used in the upgrade text. */
export const SECTIONS_PLAN_NAME = "Gold";

export type PlanLimitsRow = {
  name?: string | null;
  max_photos?: number | null;
  max_products?: number | null;
  max_services?: number | null;
};

export type PlanFeatures = {
  planName: string | null;
  /** The Services section (list + manager). */
  services: boolean;
  /** The Products section (list + manager). */
  products: boolean;
  /** Photos allowed; -1 = unlimited, null = not known. */
  maxPhotos: number | null;
};

/** A plan column as a limit: null = the free default, a negative number = unlimited (-1). */
export const limitOf = (value: number | null | undefined, freeDefault: number): number => (value == null ? freeDefault : value < 0 ? -1 : value);

export const ALL_FEATURES: PlanFeatures = { planName: null, services: true, products: true, maxPhotos: -1 };

/**
 * `plan` is the business's current plan row; `hasPlan` says whether it points at a plan at all.
 *  - admin: everything, whatever the plan;
 *  - no plan at all: the free defaults (3 services, 3 products), as the database does;
 *  - a plan the reader could not load (e.g. switched off): unknown, so nothing is hidden (the database still decides on save);
 *  - otherwise a section is on when its limit is not 0.
 */
export function planFeaturesFor(plan: PlanLimitsRow | null | undefined, opts: { isAdmin: boolean; hasPlan: boolean }): PlanFeatures {
  if (opts.isAdmin) return { ...ALL_FEATURES };
  if (!opts.hasPlan) return { planName: null, services: limitOf(null, FREE_PLAN_LIMITS.services) !== 0, products: limitOf(null, FREE_PLAN_LIMITS.products) !== 0, maxPhotos: FREE_PLAN_LIMITS.photos };
  if (!plan) return { ...ALL_FEATURES };
  return {
    planName: plan.name ?? null,
    services: limitOf(plan.max_services, FREE_PLAN_LIMITS.services) !== 0,
    products: limitOf(plan.max_products, FREE_PLAN_LIMITS.products) !== 0,
    maxPhotos: limitOf(plan.max_photos, FREE_PLAN_LIMITS.photos),
  };
}

export type SectionKind = "services" | "products";

/** The sections this plan does NOT include ("Services", "Products"), in display order. */
export function missingSections(features: Pick<PlanFeatures, "services" | "products">): Array<"Services" | "Products"> {
  const out: Array<"Services" | "Products"> = [];
  if (!features.services) out.push("Services");
  if (!features.products) out.push("Products");
  return out;
}

/** "Services aur Products Gold plan mein milte hain. Upgrade ke liye Kutchi Hub se sampark karein" (one name or both). */
export function sectionsUpgradeText(missing: ReadonlyArray<string>): string {
  return `${missing.join(" aur ")} ${SECTIONS_PLAN_NAME} plan mein milte hain. Upgrade ke liye Kutchi Hub se sampark karein`;
}

/** The message a server function answers when a plan without the section tries to save into it. */
export const sectionPlanMessage = (kind: SectionKind): string => sectionsUpgradeText([kind === "services" ? "Services" : "Products"]);
