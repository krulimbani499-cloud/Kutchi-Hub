// Indian mobile helpers shared by the business form (client) and the server schema.
const MOBILE = /^(?:\+91|91|0)?([6-9]\d{9})$/;

export const PHONE_ERROR = "Enter a 10-digit Indian mobile number (+91 allowed)";

export const isValidIndianMobile = (value: string) => MOBILE.test(value.replace(/[\s\-().]/g, ""));

/** The bare 10 digits of an Indian mobile ("+91 95103-45341", "095103 45341" -> "9510345341"); null when it is not a valid mobile. */
export const normalizeIndianMobile = (value: string): string | null => MOBILE.exec(value.replace(/[\s\-().]/g, ""))?.[1] ?? null;

export const telHref =(value: string) => `tel:${value.replace(/[^\d+]/g, "")}`;

/** wa.me link for an Indian mobile ("95103 45341", "+91 95103 45341", "095103..." all work); null when it is not a valid mobile. */
export const whatsappHref = (value: string, text?: string): string | null => {
  const m = MOBILE.exec(value.replace(/[\s\-().]/g, ""));
  return m ? `https://wa.me/91${m[1]}${text ? `?text=${encodeURIComponent(text)}` : ""}` : null;
};
