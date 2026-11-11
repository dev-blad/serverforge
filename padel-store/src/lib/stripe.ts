import "server-only";
import Stripe from "stripe";
import { db } from "@/lib/db";

let stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY, { appInfo: { name: "Courtline Padel" } });
  return stripe;
}

/** Stripe instance used only for webhook signature verification (no network calls). */
export function getWebhookVerifier(): Stripe {
  return getStripe() ?? new Stripe("sk_test_signature_verification_only");
}

export async function ensureStripeCustomer(userId: string): Promise<string | null> {
  const s = getStripe();
  if (!s) return null;
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await s.customers.create({ email: user.email, name: user.name ?? undefined, metadata: { userId } });
  await db.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

export interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  wallet: string | null;
}

export async function listSavedCards(stripeCustomerId: string | null | undefined): Promise<SavedCard[]> {
  const s = getStripe();
  if (!s || !stripeCustomerId) return [];
  try {
    const pms = await s.paymentMethods.list({ customer: stripeCustomerId, type: "card", limit: 10 });
    return pms.data.map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand ?? "card",
      last4: pm.card?.last4 ?? "????",
      expMonth: pm.card?.exp_month ?? 0,
      expYear: pm.card?.exp_year ?? 0,
      wallet: pm.card?.wallet?.type ?? null,
    }));
  } catch (e) {
    console.error("[stripe] listSavedCards failed", e);
    return [];
  }
}

export function describeCharge(charge: Stripe.Charge | null | undefined): string | null {
  const d = charge?.payment_method_details;
  if (!d) return null;
  if (d.card) {
    const wallet = d.card.wallet?.type ? ` (${d.card.wallet.type.replace("_", " ")})` : "";
    return `${d.card.brand?.toUpperCase()} •••• ${d.card.last4}${wallet}`;
  }
  return d.type.replace(/_/g, " ");
}
