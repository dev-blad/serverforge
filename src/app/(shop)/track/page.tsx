import type { Metadata } from "next";
import { db } from "@/lib/db";
import { formatOrderNumber, parseOrderNumber } from "@/lib/utils";
import { OrderTimeline } from "@/components/account/order-status-badge";
import { formatPrice } from "@/lib/money";

export const metadata: Metadata = { title: "Track your order", description: "Track your Courtline Padel order with your order number and email." };
export const dynamic = "force-dynamic";

export default async function TrackPage({ searchParams }: { searchParams: Promise<{ order?: string; email?: string }> }) {
  const sp = await searchParams;
  const n = sp.order ? parseOrderNumber(sp.order) : null;
  const order =
    n && sp.email
      ? await db.order.findFirst({ where: { number: n, email: sp.email.trim().toLowerCase(), status: { not: "PENDING_PAYMENT" } }, include: { items: true } })
      : null;
  const searched = Boolean(sp.order || sp.email);
  return (
    <div className="container-page max-w-2xl py-12">
      <h1 className="text-3xl font-extrabold">Track your order</h1>
      <p className="mt-2 text-muted">Enter your order number (e.g. CL-10042) and the email you used at checkout.</p>
      <form className="card mt-6 grid gap-4 p-6 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="t-order" className="label">Order number</label>
          <input id="t-order" name="order" required defaultValue={sp.order} className="input uppercase" placeholder="CL-10042" />
        </div>
        <div>
          <label htmlFor="t-email" className="label">Email</label>
          <input id="t-email" name="email" type="email" required defaultValue={sp.email} className="input" autoComplete="email" />
        </div>
        <button className="btn-primary">Track</button>
      </form>
      {searched && !order && <p role="alert" className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-sale">We couldn&apos;t find an order matching those details. Please check and try again.</p>}
      {order && (
        <section className="card mt-6 space-y-5 p-6" aria-live="polite">
          <div className="flex flex-wrap justify-between gap-2">
            <h2 className="text-lg font-bold">Order {formatOrderNumber(order.number)}</h2>
            <span className="text-sm text-muted">{formatPrice(order.total)} · {order.shippingMethod}</span>
          </div>
          <OrderTimeline order={order} />
          {order.trackingNumber && order.status !== "PAID" && (
            <p className="text-sm">
              {order.carrier} tracking number <strong>{order.trackingNumber}</strong>{" "}
              {order.trackingUrl && <a href={order.trackingUrl} className="font-semibold text-brand-700 underline" target="_blank" rel="noopener noreferrer">Track with {order.carrier}</a>}
            </p>
          )}
          <ul className="text-sm">
            {order.items.map((i) => (
              <li key={i.id}>{i.quantity} × {i.name} <span className="text-muted">({i.variantName})</span></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
