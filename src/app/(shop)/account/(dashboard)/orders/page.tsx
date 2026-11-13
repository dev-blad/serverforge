import Image from "next/image";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { formatDate, formatOrderNumber } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/account/order-status-badge";
import { reorder } from "@/app/actions/account";

export const metadata = { title: "Your orders" };

export default async function OrdersPage() {
  const user = await requireUser("/account/orders");
  const orders = await db.order.findMany({
    where: { userId: user.id, status: { not: "PENDING_PAYMENT" } },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });
  return (
    <div>
      <h2 className="text-xl font-bold">Order history</h2>
      {orders.length === 0 && <p className="mt-3 text-muted">You haven&apos;t placed any orders yet.</p>}
      <ul className="mt-4 space-y-4">
        {orders.map((o) => (
          <li key={o.id} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold">{formatOrderNumber(o.number)}</p>
                <p className="text-xs text-muted">Placed {formatDate(o.createdAt)} · {formatPrice(o.total)}</p>
              </div>
              <OrderStatusBadge status={o.status} />
            </div>
            <ul className="mt-4 flex flex-wrap gap-2">
              {o.items.map((i) => (
                <li key={i.id} className="relative size-14 overflow-hidden rounded-lg bg-canvas" title={`${i.name} × ${i.quantity}`}>
                  {i.image && <Image src={i.image} alt={i.name} fill sizes="56px" className="object-cover" unoptimized />}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/account/orders/${o.id}`} className="btn-outline btn-sm">View details</Link>
              <form action={reorder}>
                <input type="hidden" name="orderId" value={o.id} />
                <button className="btn-primary btn-sm">Buy again</button>
              </form>
              {o.trackingUrl && <a href={o.trackingUrl} className="btn-outline btn-sm" target="_blank" rel="noopener noreferrer">Track parcel</a>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
