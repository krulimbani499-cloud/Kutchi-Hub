// Indian mobile helpers shared by the business form (client) and the server schema.
const MOBILE = /^(?:\+91|91|0)?([6-9]\d{9})$/;

export const PHONE_ERROR = "Enter a 10-digit Indian mobile number (+91 allowed)";

export const isValidIndianMobile = (value: string) => MOBILE.test(value.replace(/[\s\-().]/g, ""));

export const telHref = (value: string) => `tel:${value.replace(/[^\d+]/g, "")}`;
