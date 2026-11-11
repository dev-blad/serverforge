import "server-only";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { afterOrderPaid, logOrderEvent, markOrderPaid, runAfter } from "@/lib/orders";
import { describeCharge, getStripe } from "@/lib/stripe";

/**
 * Handle a succeeded PaymentIntent (from the webhook or the return page).
 * Verifies the amount matches the order before marking it paid. Idempotent.
 */
export async function handlePaymentIntentSucceeded(pi: Stripe.PaymentIntent, opts: { inline?: boolean } = {}) {
  const orderId = pi.metadata?.orderId;
  const order = orderId
    ? await db.order.findUnique({ where: { id: orderId } })
    : await db.order.findUnique({ where: { stripePaymentIntentId: pi.id } });
  if (!order) return { ok: false as const, reason: "order-not-found" };
  if (pi.status !== "succeeded") return { ok: false as const, reason: "not-succeeded" };
  if (pi.amount_received !== order.total || pi.currency !== "gbp") {
    await logOrderEvent(order.id, "error", `Amount mismatch: received ${pi.amount_received} ${pi.currency}, expected ${order.total}`);
    return { ok: false as const, reason: "amount-mismatch" };
  }

  let summary: string | null = null;
  const s = getStripe();
  if (s) {
    try {
      const chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id;
      if (chargeId) summary = describeCharge(await s.charges.retrieve(chargeId));
    } catch {
      /* summary is cosmetic */
    }
  }

  const processed = await markOrderPaid(order.id, {
    provider: "stripe",
    paymentIntentId: pi.id,
    summary,
    stripeCustomerId: typeof pi.customer === "string" ? pi.customer : (pi.customer?.id ?? null),
  });
  if (processed) {
    if (opts.inline) await afterOrderPaid(order.id);
    else await runAfter(() => afterOrderPaid(order.id));
  }
  return { ok: true as const, processed, orderId: order.id };
}

export async function handleChargeRefunded(charge: Stripe.Charge) {
  const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!piId) return;
  const order = await db.order.findUnique({ where: { stripePaymentIntentId: piId } });
  if (!order || order.status === "REFUNDED" || order.status === "CANCELLED") return;
  if (charge.amount_refunded >= charge.amount) {
    await db.order.update({ where: { id: order.id }, data: { status: "REFUNDED", refundedAt: new Date() } });
    await logOrderEvent(order.id, "status", "Refunded in Stripe dashboard → REFUNDED");
  } else {
    await logOrderEvent(order.id, "refund", `Partial refund of £${(charge.amount_refunded / 100).toFixed(2)} issued in Stripe`);
  }
}
