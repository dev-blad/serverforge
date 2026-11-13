import Link from "next/link";
import type { OrderStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { formatDate, formatOrderNumber, parseOrderNumber } from "@/lib/utils";
import { FilterTabs, PageHeader, Table } from "@/components/admin/ui";
import { OrderStatusBadge } from "@/components/account/order-status-badge";

export const metadata = { title: "Orders" };
const STATUSES: OrderStatus[] = ["PAID", "PACKED", "SHIPPED", "DELIVERED", "REFUNDED", "CANCELLED", "PENDING_PAYMENT"];

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string; source?: string }> }) {
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as OrderStatus) ? (sp.status as OrderStatus) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim();
  const num = q ? parseOrderNumber(q) : null;
  const where: Prisma.OrderWhereInput = {
    ...(status ? { status } : { status: { not: "PENDING_PAYMENT" } }),
    ...(sp.source === "web" ? { source: "web" } : {}),
    ...(q ? { OR: [...(num ? [{ number: num }] : []), { email: { contains: q, mode: "insensitive" } }, { trackingNumber: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const [orders, total, counts] = await Promise.all([
    db.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 25, take: 25, include: { _count: { select: { items: true } }, shipment: { select: { status: true } } } }),
    db.order.count({ where }),
    db.order.groupBy({ by: ["status"], _count: true }),
  ]);
  const count = (s: OrderStatus) => counts.find((c) => c.status === s)?._count ?? 0;
  const link = (o: Record<string, string | undefined>) => `/admin/orders?${new URLSearchParams(Object.entries({ status, q, source: sp.source, ...o }).filter(([, v]) => v) as [string, string][])}`;
  return (
    <div>
      <PageHeader title="Orders" description={`${total} orders`} actions={<Link href="/admin/fulfilment" className="btn-primary btn-sm">Orders to pack</Link>} />
      <FilterTabs current={status ?? "all"} items={[{ key: "all", label: "All paid", href: link({ status: undefined, page: undefined }) }, ...STATUSES.map((s) => ({ key: s, label: s.replace("_", " ").toLowerCase(), href: link({ status: s, page: undefined }), count: count(s) }))]} />
      <form className="mb-4 flex flex-wrap gap-2">
        {status && <input type="hidden" name="status" value={status} />}
        <label htmlFor="oq" className="sr-only">Search orders</label>
        <input id="oq" name="q" defaultValue={q} placeholder="Order no., email or tracking" className="input max-w-xs" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="source" value="web" defaultChecked={sp.source === "web"} className="accent-brand-900" /> Real orders only</label>
        <button className="btn-outline btn-sm">Search</button>
      </form>
      <div className="card p-2">
        <Table head={["Order", "Date", "Customer", "Items", "Total", "Status", "Label"]}>
          {orders.map((o) => (
            <tr key={o.id} className="hover:bg-canvas">
              <td className="px-2 py-2.5 font-semibold"><Link href={`/admin/orders/${o.id}`} className="hover:underline">{formatOrderNumber(o.number)}</Link>{o.source === "seed" && <span className="ml-1 text-[10px] text-muted">demo</span>}</td>
              <td className="px-2">{formatDate(o.createdAt, { dateStyle: "short", timeStyle: "short" })}</td>
              <td className="max-w-48 truncate px-2">{(o.shippingAddress as { name?: string }).name}<br /><span className="text-xs text-muted">{o.email}</span></td>
              <td className="px-2">{o._count.items}</td>
              <td className="px-2 font-semibold">{formatPrice(o.total)}</td>
              <td className="px-2"><OrderStatusBadge status={o.status} /></td>
              <td className="px-2 text-xs text-muted">{o.shipment?.status.replace("_", " ").toLowerCase() ?? "—"}</td>
            </tr>
          ))}
        </Table>
      </div>
      <div className="mt-4 flex justify-between text-sm">
        {page > 1 ? <Link href={link({ page: String(page - 1) })} className="btn-outline btn-sm">Previous</Link> : <span />}
        {page * 25 < total && <Link href={link({ page: String(page + 1) })} className="btn-outline btn-sm">Next</Link>}
      </div>
    </div>
  );
}
