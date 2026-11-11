import { afterAll, describe, expect, it } from "vitest";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { upsertPendingOrder } from "@/lib/orders";
import { POST } from "@/app/api/webhooks/stripe/route";
import { address, makeCart, makeProduct } from "../support/factory";

afterAll(() => db.$disconnect());

const stripe = new Stripe("sk_test_dummy");

function signedRequest(event: object, secret = process.env.STRIPE_WEBHOOK_SECRET!) {
  const payload = JSON.stringify(event);
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  return new Request("http://localhost/api/webhooks/stripe", { method: "POST", body: payload, headers: { "stripe-signature": header, "content-type": "application/json" } });
}

function piEvent(orderId: string, amount: number, id = `pi_test_${orderId}`) {
  return {
    id: `evt_${Math.random().toString(36).slice(2)}`,
    object: "event",
    type: "payment_intent.succeeded",
    data: { object: { id, object: "payment_intent", status: "succeeded", amount, amount_received: amount, currency: "gbp", customer: null, latest_charge: null, metadata: { orderId } } },
  };
}

async function pendingOrder(email: string) {
  const p = await makeProduct({ price: 15000, stock: 3 });
  const cart = await makeCart([{ variantId: p.variants[0]!.id, quantity: 1 }]);
  const order = await upsertPendingOrder({ cartId: cart.id, userId: null, email, address, shippingMethodId: "rm-tracked48", savePaymentMethod: false });
  return { order, variantId: p.variants[0]!.id };
}

describe("Stripe webhook", () => {
  it("rejects bad signatures", async () => {
    const { order } = await pendingOrder("badsig@example.com");
    const res = await POST(signedRequest(piEvent(order.id, order.total), "whsec_wrong"));
    expect(res.status).toBe(400);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING_PAYMENT");
  });

  it("payment_intent.succeeded marks the order paid, creates a label and sends confirmation — idempotently", async () => {
    const { order, variantId } = await pendingOrder("webhook@example.com");
    const event = piEvent(order.id, order.total);
    const res = await POST(signedRequest(event));
    expect(res.status).toBe(200);

    const paid = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { shipment: true } });
    expect(paid.status).toBe("PAID");
    expect(paid.stripePaymentIntentId).toBe(`pi_test_${order.id}`);
    expect(paid.shipment?.status).toBe("LABEL_CREATED");
    expect(paid.trackingNumber).toBeTruthy();
    expect(await db.emailLog.count({ where: { to: "webhook@example.com", template: "order-confirmation" } })).toBe(1);
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(2);

    // Stripe retries / duplicate delivery must not double-process
    const again = await POST(signedRequest(event));
    expect(again.status).toBe(200);
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(2);
    expect(await db.emailLog.count({ where: { to: "webhook@example.com", template: "order-confirmation" } })).toBe(1);
  });

  it("does not mark paid when the amount doesn't match", async () => {
    const { order } = await pendingOrder("mismatch@example.com");
    const res = await POST(signedRequest(piEvent(order.id, order.total - 100)));
    expect(res.status).toBe(200);
    const o = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { events: true } });
    expect(o.status).toBe("PENDING_PAYMENT");
    expect(o.events.some((e) => e.message.includes("Amount mismatch"))).toBe(true);
  });

  it("charge.refunded from the Stripe dashboard marks the order refunded", async () => {
    const { order } = await pendingOrder("refund@example.com");
    await POST(signedRequest(piEvent(order.id, order.total, "pi_refund_test")));
    const res = await POST(
      signedRequest({ id: "evt_r", object: "event", type: "charge.refunded", data: { object: { id: "ch_1", object: "charge", payment_intent: "pi_refund_test", amount: order.total, amount_refunded: order.total } } }),
    );
    expect(res.status).toBe(200);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("REFUNDED");
  });
});
