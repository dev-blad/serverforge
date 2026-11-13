import Image from "next/image";
import type { Order, OrderItem } from "@prisma/client";
import { formatPrice } from "@/lib/money";
import { formatDate, formatOrderNumber } from "@/lib/utils";
import { OrderTimeline } from "./order-status-badge";
import { CartSummary } from "@/components/cart/cart-summary";

export function OrderDetail({ order }: { order: Order & { items: OrderItem[] } }) {
  const a = order.shippingAddress as Record<string, string | undefined>;
  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold">Order {formatOrderNumber(order.number)}</h2>
          <p className="text-sm text-muted">Placed {formatDate(order.createdAt, { dateStyle: "long" })}</p>
        </div>
        <div className="mt-5">
          <OrderTimeline order={order} />
        </div>
        {order.trackingNumber && order.status !== "PAID" && (
          <p className="mt-4 text-sm">
            {order.carrier} tracking: <strong>{order.trackingNumber}</strong>{" "}
            {order.trackingUrl && <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 underline">Track parcel</a>}
          </p>
        )}
      </div>
      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="card p-6">
          <h3 className="font-bold">Items</h3>
          <ul className="mt-3 divide-y divide-line">
            {order.items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-3">
                <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-canvas">{i.image && <Image src={i.image} alt="" fill sizes="56px" className="object-cover" unoptimized />}</div>
                <div className="flex-1 text-sm">
                  <p className="font-semibold">{i.name}</p>
                  <p className="text-xs text-muted">{i.variantName} · {i.quantity} × {formatPrice(i.unitPrice)}</p>
                </div>
                <p className="text-sm font-semibold">{formatPrice(i.unitPrice * i.quantity)}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="mb-3 font-bold">Summary</h3>
            <CartSummary
              shippingLabel={order.shippingMethod}
              totals={{ subtotal: order.subtotal, discountTotal: order.discountTotal, shippingTotal: order.shippingTotal, shippingBeforeDiscount: order.shippingTotal, giftCardTotal: order.giftCardTotal, taxTotal: order.taxTotal, total: order.total, freeShippingRemaining: 0, qualifiesForFreeShipping: false }}
            />
            {order.paymentMethodSummary && <p className="mt-3 text-xs text-muted">Paid with {order.paymentMethodSummary}</p>}
          </div>
          <div className="card p-6">
            <h3 className="font-bold">Delivery address</h3>
            <address className="mt-2 text-sm not-italic text-ink/80">
              {[a.name, a.line1, a.line2, a.city, a.county, a.postcode].filter(Boolean).map((l) => (
                <span key={l} className="block">{l}</span>
              ))}
            </address>
          </div>
        </div>
      </div>
    </div>
  );
}
