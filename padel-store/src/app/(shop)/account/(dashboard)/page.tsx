import Link from "next/link";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { formatDate, formatOrderNumber } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/account/order-status-badge";

export default async function AccountOverview() {
  const user = await requireUser();
  const [orders, address, count] = await Promise.all([
    db.order.findMany({ where: { userId: user.id, status: { not: "PENDING_PAYMENT" } }, orderBy: { createdAt: "desc" }, take: 3, include: { items: true } }),
    db.address.findFirst({ where: { userId: user.id, isDefault: true } }),
    db.order.count({ where: { userId: user.id, status: { not: "PENDING_PAYMENT" } } }),
  ]);
  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Recent orders</h2>
          <Link href="/account/orders" className="text-sm font-semibold text-brand-700 underline">All orders ({count})</Link>
        </div>
        {orders.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No orders yet. <Link href="/c/rackets" className="underline">Start shopping</Link></p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <Link href={`/account/orders/${o.id}`} className="font-semibold hover:underline">{formatOrderNumber(o.number)}</Link>
                  <p className="text-xs text-muted">{formatDate(o.createdAt)} · {o.items.reduce((s, i) => s + i.quantity, 0)} items · {formatPrice(o.total)}</p>
                </div>
                <OrderStatusBadge status={o.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="grid gap-6 md:grid-cols-2">
        <section className="card p-6">
          <h2 className="text-lg font-bold">Default address</h2>
          {address ? (
            <address className="mt-2 text-sm not-italic text-ink/80">{[address.name, address.line1, address.line2, address.city, address.postcode].filter(Boolean).join(", ")}</address>
          ) : (
            <p className="mt-2 text-sm text-muted">No saved address yet.</p>
          )}
          <Link href="/account/addresses" className="mt-3 inline-block text-sm font-semibold text-brand-700 underline">Manage addresses</Link>
        </section>
        <section className="card p-6">
          <h2 className="text-lg font-bold">Account details</h2>
          <p className="mt-2 text-sm text-ink/80">{user.name}<br />{user.email}</p>
          <Link href="/account/settings" className="mt-3 inline-block text-sm font-semibold text-brand-700 underline">Edit details</Link>
        </section>
      </div>
    </div>
  );
}
