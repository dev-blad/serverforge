import "server-only";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/send";
import { abandonedCartEmail } from "@/lib/email/templates";
import { absoluteUrl } from "@/lib/utils";

/**
 * Email shoppers who entered their email at checkout but didn't pay.
 * Window: carts idle for 1–48 hours, one reminder per cart activity.
 */
export async function sendAbandonedCartEmails(now = new Date()) {
  const from = new Date(now.getTime() - 48 * 3600_000);
  const to = new Date(now.getTime() - 60 * 60_000);
  const carts = await db.cart.findMany({
    where: { email: { not: null }, abandonedEmailSentAt: null, updatedAt: { gte: from, lte: to }, items: { some: {} } },
    include: { items: { include: { variant: { include: { product: true } } } } },
    take: 100,
  });
  let sent = 0;
  for (const cart of carts) {
    const paid = await db.order.findFirst({ where: { cartId: cart.id, status: { not: "PENDING_PAYMENT" }, createdAt: { gte: cart.updatedAt } } });
    if (paid) continue;
    const items = cart.items.map((i) => ({ name: i.variant.product.name, variantName: i.variant.name, quantity: i.quantity, unitPrice: i.variant.price ?? i.variant.product.price }));
    const { subject, html } = abandonedCartEmail(items, absoluteUrl(`/cart-recover?token=${cart.token}`));
    await sendEmail({ to: cart.email!, subject, html, template: "abandoned-cart" });
    await db.cart.update({ where: { id: cart.id }, data: { abandonedEmailSentAt: now, updatedAt: cart.updatedAt } });
    sent++;
  }
  return { checked: carts.length, sent };
}
