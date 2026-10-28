/**
 * THE switch for plan prices. false = the public (logged out, normal users, business owners; website, Android and iOS app) sees no
 * prices, no plan cards and no Upgrade / View plans / Buy buttons: they see "Contact Kutchi Hub" (Call / WhatsApp) instead.
 * Admins still see everything. Set to true to show prices again (the iOS app keeps hiding them either way: Apple rule 3.1.1).
 * Parts of the page read this through the usePricingVisible() hook (src/hooks/usePricingVisible.ts), never directly.
 */
export const SHOW_PUBLIC_PRICING = false;

/**
 * DIWALI THEME: ON automatically from DIWALI_START to DIWALI_END (IST), OFF before and after: nothing to switch by hand.
 * Next year: change these two dates (keep the +05:30). The year in DIWALI_START also names the "already dismissed / fireworks
 * played" flags, so they start fresh every year. Preview before the dates: add ?diwali=1 to any address (memory only, not stored).
 */
export const DIWALI_START = "2026-11-04T00:00:00+05:30";
export const DIWALI_END = "2026-11-12T23:59:59.999+05:30";
