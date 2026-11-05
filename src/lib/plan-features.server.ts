// Server side of plan-features.ts: reads a business's plan and refuses a save into a section the plan does not include.
// SERVER ONLY. The database trigger (enforce_business_plan_limit) already refuses NEW rows when the limit is 0; this also refuses
// changes to existing rows and says it in plain words, and it is the check that does not depend on how the trigger was installed.
import { planFeaturesFor, sectionPlanMessage, type PlanFeatures, type PlanLimitsRow, type SectionKind } from "./plan-features";

/** The few query methods used (the Supabase client has all of them). */
export interface PlanDb {
  rpc(fn: "has_role", args: { _user_id: string; _role: "admin" }): PromiseLike<{ data: unknown; error: { message: string } | null }>;
  from(table: "businesses"): {
    select(columns: string): {
      eq(column: "id", value: string): { maybeSingle(): PromiseLike<{ data: unknown; error: { message: string } | null }> };
    };
  };
}

type BusinessPlanRow = { current_plan_id: string | null; plans: PlanLimitsRow | null };

/** What the business's plan includes, for this person (an admin always gets everything). Unreadable = nothing is blocked. */
export async function loadPlanFeatures(db: PlanDb, userId: string, businessId: string): Promise<PlanFeatures> {
  const { data: isAdmin } = await db.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (isAdmin === true) return planFeaturesFor(null, { isAdmin: true, hasPlan: true });
  const { data, error } = await db.from("businesses").select("current_plan_id, plans:current_plan_id(name, max_photos, max_products, max_services)").eq("id", businessId).maybeSingle();
  if (error || !data) return planFeaturesFor(null, { isAdmin: false, hasPlan: true }); // could not read: do not guess, the database still decides
  const row = data as BusinessPlanRow;
  return planFeaturesFor(row.plans, { isAdmin: false, hasPlan: row.current_plan_id != null });
}

/** Throws the owner-facing message when the business's plan does not include `kind`. */
export async function assertPlanAllowsSection(db: PlanDb, userId: string, businessId: string, kind: SectionKind): Promise<void> {
  const features = await loadPlanFeatures(db, userId, businessId);
  if (!features[kind]) throw new Error(sectionPlanMessage(kind));
}
