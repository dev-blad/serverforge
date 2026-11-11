import "server-only";
import { db } from "@/lib/db";

export async function getOrdersToPack() {
  return db.order.findMany({
    where: { status: { in: ["PAID", "PACKED"] } },
    orderBy: { paidAt: "asc" },
    include: { items: true, shipment: { select: { status: true, trackingNumber: true, error: true, printedAt: true } } },
  });
}

export function pickList(orders: Awaited<ReturnType<typeof getOrdersToPack>>) {
  const m = new Map<string, { sku: string; name: string; variant: string; qty: number }>();
  for (const o of orders) for (const i of o.items) {
    const e = m.get(i.sku) ?? { sku: i.sku, name: i.name, variant: i.variantName, qty: 0 };
    e.qty += i.quantity;
    m.set(i.sku, e);
  }
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
}
