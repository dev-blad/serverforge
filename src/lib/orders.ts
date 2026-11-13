import "server-only";
import { after } from "next/server";
import type { Order, OrderStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { features, store } from "@/lib/config";
import { sendEmail } from "@/lib/email/send";
import {
  orderConfirmationEmail,
  orderStatusEmail,
  shippingNotificationEmail,
  simpleEmail,
  type EmailOrder,
} from "@/lib/email/templates";
import { computeTotals } from "@/lib/pricing";
import { getShippingMethod } from "@/lib/shipping-rates";
import { getStripe } from "@/lib/stripe";
import { absoluteUrl, formatOrderNumber } from "@/lib/utils";
import { createShipmentForOrder } from "@/lib/fulfilment";
import { formatPrice } from "@/lib/money";

export interface ShippingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  county?: string;
  postcode: string;
  country: string;
  phone?: string;
}

export class CheckoutError extends Error {}

export async function logOrderEvent(orderId: string, type: string, message: string) {
  await db.orderEvent.create({ data: { orderId, type, message } });
}

/** Run work after the response is sent when inside a request; otherwise run inline (tests, scripts). */
export async function runAfter(fn: () => Promise<void>) {
  try {
    after(fn);
  } catch {
    await fn();
  }
}

/**
 * Create (or refresh) the PENDING_PAYMENT order for a cart. Re-submitting checkout
 * updates the same order so we never accumulate duplicates.
 */
export async function upsertPendingOrder(input: {
  cartId: string;
  userId: string | null;
  email: string;
  address: ShippingAddress;
  shippingMethodId: string;
  savePaymentMethod: boolean;
  customerNote?: string;
}): Promise<Order> {
  const cart = await db.cart.findUnique({
    where: { id: input.cartId },
    include: { items: { include: { variant: { include: { product: true } } } } },
  });
  if (!cart || cart.items.length === 0) throw new CheckoutError("Your basket is empty.");

  for (const i of cart.items) {
    if (i.variant.product.status !== "ACTIVE") throw new CheckoutError(`${i.variant.product.name} is no longer available.`);
    if (i.variant.stock < i.quantity)
      throw new CheckoutError(
        i.variant.stock <= 0
          ? `${i.variant.product.name} (${i.variant.name}) is out of stock.`
          : `Only ${i.variant.stock} of ${i.variant.product.name} (${i.variant.name}) left — please update your basket.`,
      );
  }

  const lines = cart.items.map((i) => ({
    productId: i.variant.productId,
    variantId: i.variantId,
    name: i.variant.product.name,
    variantName: i.variant.name,
    sku: i.variant.sku,
    image: i.variant.product.images[0] ?? null,
    unitPrice: i.variant.price ?? i.variant.product.price,
    quantity: i.quantity,
  }));

  const [discount, giftCard] = await Promise.all([
    cart.discountCode ? db.discount.findUnique({ where: { code: cart.discountCode } }) : null,
    cart.giftCardCode ? db.giftCard.findUnique({ where: { code: cart.giftCardCode } }) : null,
  ]);
  const totals = computeTotals({ lines, shippingMethodId: input.shippingMethodId, discount, giftCard });
  if (totals.total > 0 && totals.total < 30) throw new CheckoutError("Order total is below the minimum card payment of £0.30.");
  const method = getShippingMethod(input.shippingMethodId);

  const data = {
    userId: input.userId,
    email: input.email.toLowerCase(),
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    shippingTotal: totals.shippingTotal,
    giftCardTotal: totals.giftCardTotal,
    taxTotal: totals.taxTotal,
    total: totals.total,
    shippingMethod: method.name,
    carrier: method.carrier,
    shippingAddress: input.address as unknown as Prisma.InputJsonValue,
    discountCode: totals.discountTotal > 0 || discount?.type === "FREE_SHIPPING" ? cart.discountCode : null,
    giftCardCode: totals.giftCardTotal > 0 ? cart.giftCardCode : null,
    savePaymentMethod: input.savePaymentMethod,
    customerNote: input.customerNote || null,
    cartId: cart.id,
  } satisfies Prisma.OrderUncheckedCreateInput;

  const existing = await db.order.findFirst({ where: { cartId: cart.id, status: "PENDING_PAYMENT" }, orderBy: { createdAt: "desc" } });
  await db.cart.update({ where: { id: cart.id }, data: { email: data.email } });

  if (existing) {
    return db.order.update({
      where: { id: existing.id },
      data: { ...data, items: { deleteMany: {}, create: lines } },
    });
  }
  const order = await db.order.create({ data: { ...data, items: { create: lines } } });
  await logOrderEvent(order.id, "created", "Checkout started");
  return order;
}

/**
 * Transition a pending order to PAID. Idempotent: returns false if the order
 * was already processed (e.g. duplicate webhook delivery).
 */
export async function markOrderPaid(
  orderId: string,
  payment: { provider: "stripe" | "simulated" | "giftcard"; paymentIntentId?: string; summary?: string | null; stripeCustomerId?: string | null },
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id: orderId, status: "PENDING_PAYMENT" },
      data: {
        status: "PAID",
        paidAt: new Date(),
        paymentProvider: payment.provider,
        stripePaymentIntentId: payment.paymentIntentId ?? undefined,
        paymentMethodSummary: payment.summary ?? undefined,
        stripeCustomerId: payment.stripeCustomerId ?? undefined,
      },
    });
    if (claimed.count === 0) return false;

    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    for (const item of order.items) {
      if (item.variantId) {
        const v = await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: { decrement: item.quantity } } });
        if (v.stock < 0) {
          await tx.orderEvent.create({ data: { orderId, type: "warning", message: `Oversold: ${item.sku} stock is now ${v.stock}` } });
        }
      }
      if (item.productId) {
        await tx.product.update({ where: { id: item.productId }, data: { salesCount: { increment: item.quantity } } });
      }
    }
    if (order.discountCode) {
      await tx.discount.updateMany({ where: { code: order.discountCode }, data: { usageCount: { increment: 1 } } });
    }
    if (order.giftCardCode && order.giftCardTotal > 0) {
      await tx.giftCard.updateMany({ where: { code: order.giftCardCode }, data: { balance: { decrement: order.giftCardTotal } } });
    }
    if (order.cartId) {
      await tx.cartItem.deleteMany({ where: { cartId: order.cartId } });
      await tx.cart.updateMany({ where: { id: order.cartId }, data: { discountCode: null, giftCardCode: null } });
    }
    await tx.orderEvent.create({
      data: { orderId, type: "paid", message: `Payment received (${payment.provider}${payment.summary ? `: ${payment.summary}` : ""})` },
    });
    return true;
  });
}

export const orderEmailInclude = { items: true } satisfies Prisma.OrderInclude;

/** Side effects after payment: confirmation email, owner alert, label + print. Each step is isolated. */
export async function afterOrderPaid(orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: orderEmailInclude });
  if (!order) return;
  const num = formatOrderNumber(order.number);

  try {
    const { subject, html } = orderConfirmationEmail(order as EmailOrder);
    const r = await sendEmail({ to: order.email, subject, html, template: "order-confirmation" });
    await logOrderEvent(orderId, "email", r.ok ? "Order confirmation email sent" : "Order confirmation email FAILED");
  } catch (e) {
    console.error("[orders] confirmation email failed", e);
  }

  const ownerEmail = process.env.OWNER_NOTIFICATION_EMAIL;
  if (ownerEmail) {
    const lines = order.items.map((i) => `${i.quantity} × ${i.name} (${i.variantName})`);
    const { subject, html } = simpleEmail(`New order ${num} — ${formatPrice(order.total)}`, [...lines, `Ship via ${order.shippingMethod}`], {
      href: absoluteUrl(`/admin/orders/${order.id}`),
      label: "Open in admin",
    });
    await sendEmail({ to: ownerEmail, subject, html, template: "owner-new-order" }).catch(() => {});
  }

  if (features.autoLabels) {
    try {
      await createShipmentForOrder(orderId);
    } catch (e) {
      console.error("[orders] label flow failed", e);
    }
  }
}

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["PAID", "CANCELLED"],
  PAID: ["PACKED", "SHIPPED", "REFUNDED", "CANCELLED"],
  PACKED: ["SHIPPED", "REFUNDED"],
  SHIPPED: ["DELIVERED", "REFUNDED"],
  DELIVERED: ["REFUNDED"],
  REFUNDED: [],
  CANCELLED: [],
};

export function allowedTransitions(status: OrderStatus): OrderStatus[] {
  return TRANSITIONS[status];
}

async function restock(orderId: string) {
  const items = await db.orderItem.findMany({ where: { orderId } });
  for (const i of items) {
    if (i.variantId) await db.productVariant.update({ where: { id: i.variantId }, data: { stock: { increment: i.quantity } } });
  }
}

/** Admin status workflow: paid → packed → shipped → delivered → refunded. */
export async function updateOrderStatus(
  orderId: string,
  next: OrderStatus,
  opts: { trackingNumber?: string; restock?: boolean; actor?: string } = {},
) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: orderEmailInclude });
  if (!TRANSITIONS[order.status].includes(next)) {
    throw new Error(`Cannot move an order from ${order.status} to ${next}`);
  }

  if ((next === "REFUNDED" || next === "CANCELLED") && order.status !== "PENDING_PAYMENT") {
    if (order.paymentProvider === "stripe" && order.stripePaymentIntentId) {
      const s = getStripe();
      if (!s) throw new Error("Stripe is not configured — cannot issue refund");
      await s.refunds.create({ payment_intent: order.stripePaymentIntentId, reason: "requested_by_customer" });
    }
    if (order.giftCardCode && order.giftCardTotal > 0) {
      await db.giftCard.updateMany({ where: { code: order.giftCardCode }, data: { balance: { increment: order.giftCardTotal } } });
    }
    if (opts.restock !== false) await restock(orderId);
  }

  const now = new Date();
  const stamp: Prisma.OrderUpdateInput = {
    PAID: { paidAt: now },
    PACKED: { packedAt: now },
    SHIPPED: { shippedAt: now },
    DELIVERED: { deliveredAt: now },
    REFUNDED: { refundedAt: now },
    CANCELLED: { cancelledAt: now },
    PENDING_PAYMENT: {},
  }[next];

  const updated = await db.order.update({
    where: { id: orderId },
    data: {
      status: next,
      ...stamp,
      ...(opts.trackingNumber ? { trackingNumber: opts.trackingNumber } : {}),
    },
    include: orderEmailInclude,
  });
  await logOrderEvent(orderId, "status", `Status changed ${order.status} → ${next}${opts.actor ? ` by ${opts.actor}` : ""}`);

  const emailData = updated as EmailOrder;
  if (next === "SHIPPED") {
    const { subject, html } = shippingNotificationEmail(emailData);
    await sendEmail({ to: updated.email, subject, html, template: "shipping-notification" });
    await logOrderEvent(orderId, "email", "Shipping notification email sent");
  } else if (next === "DELIVERED" || next === "REFUNDED" || (next === "CANCELLED" && order.status !== "PENDING_PAYMENT")) {
    const { subject, html } = orderStatusEmail(emailData, next);
    await sendEmail({ to: updated.email, subject, html, template: `order-${next.toLowerCase()}` });
    await logOrderEvent(orderId, "email", `${next.toLowerCase()} email sent`);
  }
  return updated;
}

export function orderAddress(o: { shippingAddress: unknown }): ShippingAddress {
  return o.shippingAddress as ShippingAddress;
}

export { store };
