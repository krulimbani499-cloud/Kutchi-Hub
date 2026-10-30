/**
 * THE switch for plan prices. false = the public (logged out, normal users, business owners; website, Android and iOS app) sees no
 * prices, no plan cards and no Upgrade / View plans / Buy buttons: they see "Contact Kutchi Hub" (Call / WhatsApp) instead.
 * Admins still see everything. Set to true to show prices again (the iOS app keeps hiding them either way: Apple rule 3.1.1).
 * Parts of the page read this through the usePricingVisible() hook (src/hooks/usePricingVisible.ts), never directly.
 */
export const SHOW_PUBLIC_PRICING = false;

/**
 * The "Get the list of top <Category> - free" form on the results pages (search, category, city, city + category: desktop sidebar and
 * the place in the list on a phone) and the admin "Search leads" tab. false = none of them is shown, and the results use the full
 * width. The component, the server code and the database SQL stay in place: set true to bring it all back.
 */
export const SHOW_SEARCH_LEAD_FORM = false;

/**
 * Saved / favourite businesses: the heart icon in the header, the heart (save) buttons on business cards, result cards and the
 * business page, the "Saved businesses" button on the Dashboard, and the /favorites page. false = none of them is shown and
 * /favorites goes to /all-business. The code, the business_favorites table and the data stay in place: set true to bring it all back.
 */
export const SHOW_SAVED = false;

/**
 * The "Referral code (optional)" field on the sign-up form (website, Android and iOS app). false = the field, its label and helper
 * text are not shown, and the form closes up with no gap. A sign-up link with ?ref=CODE is still read and applied silently after
 * sign-up, so old shared links keep working. The referral backend, tables, dashboard and rewards code are untouched.
 */
export const SHOW_REFERRAL_ON_SIGNUP = false;

/**
 * DIWALI THEME: ON automatically from DIWALI_START to DIWALI_END (IST), OFF before and after: nothing to switch by hand.
 * Next year: change these two dates (keep the +05:30). The year in DIWALI_START also names the "already dismissed / fireworks
 * played" flags, so they start fresh every year. Preview before the dates: add ?diwali=1 to any address (memory only, not stored).
 */
export const DIWALI_START = "2026-11-04T00:00:00+05:30";
export const DIWALI_END = "2026-11-12T23:59:59.999+05:30";
