import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { OrderDetail } from "@/components/account/order-detail";
import { reorder } from "@/app/actions/account";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/account/orders/${id}`);
  const order = await db.order.findFirst({ where: { id, userId: user.id }, include: { items: true } });
  if (!order) notFound();
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/account/orders" className="btn-outline btn-sm">← All orders</Link>
        <form action={reorder}>
          <input type="hidden" name="orderId" value={order.id} />
          <button className="btn-primary btn-sm">Buy again</button>
        </form>
        <Link href={`/invoice/${order.id}`} className="btn-outline btn-sm" target="_blank">VAT invoice</Link>
        {["DELIVERED", "SHIPPED"].includes(order.status) && <Link href={`/returns?order=${order.number}`} className="btn-outline btn-sm">Return items</Link>}
      </div>
      <OrderDetail order={order} />
    </div>
  );
}
