import "server-only";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/send";
import { simpleEmail } from "@/lib/email/templates";
import { absoluteUrl } from "@/lib/utils";

/** Email everyone waiting on variants that are back in stock. */
export async function notifyBackInStock(variantIds: string[]) {
  if (!variantIds.length) return 0;
  const alerts = await db.backInStockAlert.findMany({
    where: { variantId: { in: variantIds }, notifiedAt: null, variant: { stock: { gt: 0 } } },
    include: { variant: { include: { product: true } } },
  });
  for (const a of alerts) {
    const { subject, html } = simpleEmail(
      `Back in stock: ${a.variant.product.name}`,
      [`Good news — ${a.variant.product.name} (${a.variant.name}) is back in stock.`, "Popular items sell quickly, so grab yours while you can."],
      { href: absoluteUrl(`/products/${a.variant.product.slug}`), label: "Shop now" },
    );
    await sendEmail({ to: a.email, subject, html, template: "back-in-stock" });
    await db.backInStockAlert.update({ where: { id: a.id }, data: { notifiedAt: new Date() } });
  }
  return alerts.length;
}

export async function setVariantStock(updates: { id: string; stock: number }[]) {
  const before = await db.productVariant.findMany({ where: { id: { in: updates.map((u) => u.id) } }, select: { id: true, stock: true } });
  for (const u of updates) await db.productVariant.update({ where: { id: u.id }, data: { stock: u.stock } });
  const restocked = updates.filter((u) => u.stock > 0 && (before.find((b) => b.id === u.id)?.stock ?? 0) <= 0).map((u) => u.id);
  return notifyBackInStock(restocked);
}
