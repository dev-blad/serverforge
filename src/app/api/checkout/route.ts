import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { features } from "@/lib/config";
import { loadCart } from "@/lib/cart";
import { afterOrderPaid, CheckoutError, markOrderPaid, upsertPendingOrder } from "@/lib/orders";
import { ensureStripeCustomer, getStripe, listSavedCards } from "@/lib/stripe";
import { trackEvent } from "@/lib/analytics";
import { normalisePostcode, UK_POSTCODE, formatOrderNumber } from "@/lib/utils";

const schema = z.object({
  email: z.string().trim().email().max(200),
  address: z.object({
    name: z.string().trim().min(2).max(100),
    line1: z.string().trim().min(2).max(120),
    line2: z.string().trim().max(120).optional().default(""),
    city: z.string().trim().min(2).max(80),
    county: z.string().trim().max(80).optional().default(""),
    postcode: z.string().trim().regex(UK_POSTCODE, "Enter a valid UK postcode"),
    phone: z.string().trim().max(30).optional().default(""),
  }),
  shippingMethodId: z.enum(["evri-48", "rm-tracked48", "rm-tracked24"]),
  customerNote: z.string().trim().max(500).optional(),
  marketingOptIn: z.boolean().optional(),
  saveAddress: z.boolean().optional(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Please check your details." }, { status: 400 });
  }
  const input = parsed.data;
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const cart = await loadCart();
  if (!cart) return NextResponse.json({ error: "Your basket is empty." }, { status: 400 });

  const address = { ...input.address, postcode: normalisePostcode(input.address.postcode), country: "GB" };

  let order;
  try {
    order = await upsertPendingOrder({
      cartId: cart.id,
      userId,
      email: input.email,
      address,
      shippingMethodId: input.shippingMethodId,
      savePaymentMethod: false,
      customerNote: input.customerNote,
    });
  } catch (e) {
    if (e instanceof CheckoutError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }

  if (input.marketingOptIn) {
    await db.newsletterSubscriber.upsert({ where: { email: order.email }, create: { email: order.email, source: "checkout" }, update: {} });
  }
  if (userId && input.saveAddress) {
    const exists = await db.address.findFirst({ where: { userId, line1: address.line1, postcode: address.postcode } });
    if (!exists) {
      const count = await db.address.count({ where: { userId } });
      await db.address.create({ data: { userId, ...address, isDefault: count === 0 } });
    }
  }
  await trackEvent(req, { type: "checkout_started" });

  const base = { orderId: order.id, orderNumber: formatOrderNumber(order.number), total: order.total };

  // Fully covered by a gift card — no card payment needed.
  if (order.total === 0) {
    if (await markOrderPaid(order.id, { provider: "giftcard", summary: "Gift card" })) await afterOrderPaid(order.id);
    return NextResponse.json({ ...base, status: "paid" });
  }

  const stripe = getStripe();
  if (!stripe) {
    if (!features.simulatedPayments) return NextResponse.json({ error: "Payments are not configured." }, { status: 503 });
    return NextResponse.json({ ...base, status: "simulated" });
  }

  const customerId = userId ? await ensureStripeCustomer(userId) : null;
  const shipping = {
    name: address.name,
    phone: address.phone || undefined,
    address: { line1: address.line1, line2: address.line2 || undefined, city: address.city, state: address.county || undefined, postal_code: address.postcode, country: "GB" },
  };
  const metadata = { orderId: order.id, orderNumber: base.orderNumber };

  let pi = null;
  if (order.stripePaymentIntentId) {
    const existing = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
    if (["requires_payment_method", "requires_confirmation", "requires_action"].includes(existing.status)) {
      pi = await stripe.paymentIntents.update(existing.id, { amount: order.total, shipping, metadata, receipt_email: order.email });
    }
  }
  pi ??= await stripe.paymentIntents.create(
    {
      amount: order.total,
      currency: "gbp",
      customer: customerId ?? undefined,
      automatic_payment_methods: { enabled: true },
      receipt_email: order.email,
      description: `Courtline Padel order ${base.orderNumber}`,
      shipping,
      metadata,
    },
    { idempotencyKey: `order-${order.id}-${order.total}-${order.updatedAt.getTime()}` },
  );
  if (pi.id !== order.stripePaymentIntentId) {
    await db.order.update({ where: { id: order.id }, data: { stripePaymentIntentId: pi.id, stripeCustomerId: customerId } });
  }

  let customerSessionClientSecret: string | null = null;
  if (customerId) {
    const cs = await stripe.customerSessions.create({
      customer: customerId,
      components: {
        payment_element: {
          enabled: true,
          features: {
            payment_method_redisplay: "enabled",
            payment_method_allow_redisplay_filters: ["always", "limited", "unspecified"],
            payment_method_save: "enabled",
            payment_method_save_usage: "off_session",
            payment_method_remove: "enabled",
          },
        },
      },
    });
    customerSessionClientSecret = cs.client_secret;
  }

  const savedCards = customerId ? await listSavedCards(customerId) : [];
  return NextResponse.json({
    ...base,
    status: "requires_payment",
    clientSecret: pi.client_secret,
    customerSessionClientSecret,
    savedCards,
  });
}
