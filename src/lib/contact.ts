export const CONTACT_EMAIL = "contact@kutchihub.com";
// Kutchi Hub's official number: calls and WhatsApp everywhere on the site and in the apps (change it here, and only here).
export const CONTACT_WHATSAPP = "919327097185"; // digits only, for wa.me
export const CONTACT_PHONE = "+91 93270 97185"; // as shown; tel: links strip the spaces

// Kutchi Hub's own Instagram. Change the address here and it changes everywhere it is shown.
export const INSTAGRAM_URL = "https://www.instagram.com/kutchihub?vrfl=MWxnd2l5Y3N3ZzNzNg==";
export const INSTAGRAM_HANDLE = "@kutchihub";

// The Android app on Google Play. The one address behind every "Download App" button (change it here, and only here).
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=app.kutchihub.mobile";

// Other networks: null = hidden in the footer (icon only; there is no "Coming soon" tag any more). Add the address to turn one on.
export const FACEBOOK_URL: string | null = null; // e.g. "https://facebook.com/kutchihub"
export const X_URL: string | null = null; // e.g. "https://x.com/kutchihub"

// ---- Kutchi Hub's public contact details (footer, "Need help?" section, floating WhatsApp button). One place to change them. ----
// The number is the same official one as above (one number for the public contact, the plan / activation flows and removal requests).
export const SITE_PHONE_DISPLAY = CONTACT_PHONE;
export const SITE_PHONE = `+${CONTACT_WHATSAPP}`; // for tel: links
export const SITE_WHATSAPP = CONTACT_WHATSAPP;
// null = not shown. Fill these in to show them in the footer.
export const SITE_ADDRESS: string | null = null; // e.g. "Kutchi Hub, Naroda, Ahmedabad, Gujarat 382330"
export const SITE_HOURS: string | null = null; // e.g. "Mon - Sat, 10:00 AM - 7:00 PM"

export const SITE_TEL_HREF = `tel:${SITE_PHONE}`;
export const SITE_MAILTO_HREF = `mailto:${CONTACT_EMAIL}`;
/** wa.me link to Kutchi Hub's WhatsApp with a ready-typed message. */
export const siteWhatsappHref = (message: string) => `https://wa.me/${SITE_WHATSAPP}?text=${encodeURIComponent(message)}`;
export const WHATSAPP_HELLO_MESSAGE = "Hi Kutchi Hub";
export const WHATSAPP_LISTING_MESSAGE = "Hi Kutchi Hub, I want to know more about listing my business.";
