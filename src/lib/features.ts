/**
 * THE switch for plan prices. false = the public (logged out, normal users, business owners; website, Android and iOS app) sees no
 * prices, no plan cards and no Upgrade / View plans / Buy buttons: they see "Contact Kutchi Hub" (Call / WhatsApp) instead.
 * Admins still see everything. Set to true to show prices again (the iOS app keeps hiding them either way: Apple rule 3.1.1).
 * Parts of the page read this through the usePricingVisible() hook (src/hooks/usePricingVisible.ts), never directly.
 */
export const SHOW_PUBLIC_PRICING = false;
