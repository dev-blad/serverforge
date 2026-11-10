/**
 * ─── Future: automatic key delivery on purchase (NOT IMPLEMENTED) ───────────────────────────
 *
 * This module defines the seam for a payment webhook (e.g. Stripe Checkout) that generates
 * and emails a key automatically. Nothing here talks to a payment provider yet.
 *
 * Suggested implementation:
 *  1. Add an HTTP server (e.g. `node:http` or fastify) exposing POST /webhooks/stripe.
 *  2. Verify the signature with the provider SDK (`stripe.webhooks.constructEvent(rawBody,
 *     sig, STRIPE_WEBHOOK_SECRET)`) inside a `PaymentProvider.parseWebhook` implementation.
 *  3. On `checkout.session.completed`, map the purchased price/product id → tier (and
 *     optionally a themed template) via `PRODUCT_TIERS`, then call `fulfilPurchase` below.
 *  4. Implement `KeyDelivery` with an email provider (Resend, Postmark, SES …).
 *  5. Make fulfilment idempotent: store the provider's event/order id (e.g. as the license
 *     note, or a dedicated column) and skip events you've already fulfilled.
 */
import type { Tier } from '../template/schema.js';
import type { LicenseService } from './licenseService.js';

/** A completed purchase, normalised from whatever the payment provider sends. */
export interface PurchaseEvent {
  /** Provider's unique order / event id — used for idempotency. */
  orderId: string;
  buyerEmail: string;
  tier: Tier;
  /** Optional themed template (must match the tier). */
  templateId?: string;
  quantity: number;
}

/** Turns a raw webhook request into a verified PurchaseEvent (or null to ignore it). */
export interface PaymentProvider {
  readonly name: string;
  parseWebhook(
    rawBody: Buffer,
    headers: Record<string, string | undefined>,
  ): Promise<PurchaseEvent | null>;
}

/** Sends the generated keys to the buyer. */
export interface KeyDelivery {
  deliver(to: string, keys: string[], purchase: PurchaseEvent): Promise<void>;
}

/** Example mapping from provider price ids to tiers — fill in when wiring up payments. */
export const PRODUCT_TIERS: Record<string, { tier: Tier; templateId?: string }> = {
  // 'price_123_starter': { tier: 'starter' },
  // 'price_456_pro': { tier: 'pro' },
  // 'price_789_gaming_elite': { tier: 'elite', templateId: 'gaming' },
};

/**
 * Generate keys for a purchase and deliver them. Wire this to your webhook handler once a
 * PaymentProvider and KeyDelivery exist.
 */
export async function fulfilPurchase(
  purchase: PurchaseEvent,
  deps: { licenses: LicenseService; delivery: KeyDelivery },
): Promise<string[]> {
  const generated = await deps.licenses.generate({
    tier: purchase.tier,
    count: purchase.quantity,
    templateId: purchase.templateId ?? null,
    note: `order:${purchase.orderId} email:${purchase.buyerEmail}`,
  });
  const keys = generated.map((g) => g.key);
  await deps.delivery.deliver(purchase.buyerEmail, keys, purchase);
  return keys;
}

/** Placeholder provider so the seam is visible in code; throws until implemented. */
export class StripeProviderStub implements PaymentProvider {
  readonly name = 'stripe';
  parseWebhook(): Promise<PurchaseEvent | null> {
    return Promise.reject(
      new Error('Stripe webhooks are not implemented yet — see src/services/license/payments.ts'),
    );
  }
}
