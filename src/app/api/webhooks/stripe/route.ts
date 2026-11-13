import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getWebhookVerifier } from "@/lib/stripe";
import { handleChargeRefunded, handlePaymentIntentSucceeded } from "@/lib/payments";
import { db } from "@/lib/db";
import { logOrderEvent } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!secret || !signature) return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });

  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = getWebhookVerifier().webhooks.constructEvent(payload, signature, secret);
  } catch (e) {
    return NextResponse.json({ error: `Invalid signature: ${e instanceof Error ? e.message : ""}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const result = await handlePaymentIntentSucceeded(event.data.object);
        return NextResponse.json({ received: true, ...result });
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object;
        const order = pi.metadata?.orderId ? await db.order.findUnique({ where: { id: pi.metadata.orderId } }) : null;
        if (order) await logOrderEvent(order.id, "payment_failed", pi.last_payment_error?.message ?? "Payment failed");
        break;
      }
      case "charge.refunded":
        await handleChargeRefunded(event.data.object);
        break;
      default:
        break;
    }
  } catch (e) {
    console.error(`[stripe webhook] ${event.type} failed`, e);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
