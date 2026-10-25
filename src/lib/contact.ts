export const CONTACT_EMAIL = "contact@kutchihub.com";
export const CONTACT_WHATSAPP = "917359036946"; // Admin can update
export const CONTACT_PHONE = "+91 73590 36946";

// Kutchi Hub's own Instagram. Change the address here and it changes everywhere it is shown.
export const INSTAGRAM_URL = "https://www.instagram.com/kutchihub?vrfl=MWxnd2l5Y3N3ZzNzNg==";
export const INSTAGRAM_HANDLE = "@kutchihub";

// Other networks: null = hidden in the footer (icon only; there is no "Coming soon" tag any more). Add the address to turn one on.
export const FACEBOOK_URL: string | null = null; // e.g. "https://facebook.com/kutchihub"
export const X_URL: string | null = null; // e.g. "https://x.com/kutchihub"

// ---- Kutchi Hub's public contact details (footer, "Need help?" section, floating WhatsApp button). One place to change them. ----
// NOTE: CONTACT_PHONE / CONTACT_WHATSAPP above are the older admin / support numbers used by the owner flows (pricing page, "plan
// needed" cards, removal requests). The public number below is a separate constant on purpose.
export const SITE_PHONE_DISPLAY = "+91 95872 43827";
export const SITE_PHONE = "+919587243827"; // for tel: links
export const SITE_WHATSAPP = "919587243827"; // digits only, for wa.me (the same number as SITE_PHONE)
// null = not shown. Fill these in to show them in the footer.
export const SITE_ADDRESS: string | null = null; // e.g. "Kutchi Hub, Naroda, Ahmedabad, Gujarat 382330"
export const SITE_HOURS: string | null = null; // e.g. "Mon - Sat, 10:00 AM - 7:00 PM"

export const SITE_TEL_HREF = `tel:${SITE_PHONE}`;
export const SITE_MAILTO_HREF = `mailto:${CONTACT_EMAIL}`;
/** wa.me link to Kutchi Hub's WhatsApp with a ready-typed message. */
export const siteWhatsappHref = (message: string) => `https://wa.me/${SITE_WHATSAPP}?text=${encodeURIComponent(message)}`;
export const WHATSAPP_HELLO_MESSAGE = "Hi Kutchi Hub";
export const WHATSAPP_LISTING_MESSAGE = "Hi Kutchi Hub, I want to know more about listing my business.";
