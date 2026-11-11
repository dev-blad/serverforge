/**
 * Central store configuration and feature flags.
 * Every integration is optional: when its credentials are missing the store
 * falls back to a safe local stub so the whole flow can be demoed end-to-end.
 */
export const store = {
  name: process.env.NEXT_PUBLIC_STORE_NAME ?? "Courtline Padel",
  tagline: "Padel rackets, balls & kit — shipped fast across the UK",
  email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "hello@courtline.example",
  phone: process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? "",
  companyName: process.env.NEXT_PUBLIC_COMPANY_NAME ?? "Courtline Padel Ltd",
  companyNumber: process.env.NEXT_PUBLIC_COMPANY_NUMBER ?? "00000000",
  vatNumber: process.env.NEXT_PUBLIC_VAT_NUMBER ?? "GB000000000",
  address: process.env.NEXT_PUBLIC_BUSINESS_ADDRESS ?? "Unit 1, Example Business Park, Manchester, M1 1AA",
  /** Dispatch cut-off (UK time, 24h) for same-day dispatch messaging */
  dispatchCutoffHour: 14,
} as const;

export const SHIPPING_FROM = {
  name: process.env.SHIP_FROM_NAME ?? store.companyName,
  line1: process.env.SHIP_FROM_LINE1 ?? "Unit 1, Example Business Park",
  city: process.env.SHIP_FROM_CITY ?? "Manchester",
  postcode: process.env.SHIP_FROM_POSTCODE ?? "M1 1AA",
  phone: process.env.SHIP_FROM_PHONE ?? "",
  email: process.env.SHIP_FROM_EMAIL ?? store.email,
};

const on = (v: string | undefined) => v === "1" || v === "true";

export const features = {
  stripe: Boolean(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
  /** Simulated payments are only allowed when Stripe is not configured and not explicitly disabled. */
  get simulatedPayments() {
    return !this.stripe && !on(process.env.DISABLE_SIMULATED_PAYMENTS);
  },
  email: Boolean(process.env.RESEND_API_KEY),
  google: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
  autoLabels: process.env.FULFILMENT_AUTO_LABELS !== "false",
  shippingProvider: (process.env.SHIPPING_PROVIDER ?? "stub") as "stub" | "royalmail" | "shipstation",
  printNode: Boolean(process.env.PRINTNODE_API_KEY && process.env.PRINTNODE_PRINTER_ID),
  autoPrint: process.env.FULFILMENT_AUTO_PRINT !== "false",
  whatsapp: Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_WHATSAPP_FROM &&
      process.env.OWNER_WHATSAPP_TO,
  ),
  chatProvider: (process.env.NEXT_PUBLIC_CHAT_PROVIDER ?? "internal") as "internal" | "crisp" | "tawk",
  plausibleDomain: process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN ?? "",
  vercelAnalytics: process.env.NEXT_PUBLIC_VERCEL_ANALYTICS !== "false",
};

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
