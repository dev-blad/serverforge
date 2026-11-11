import type { OrderStatus } from "@prisma/client";

const STYLES: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "bg-gray-100 text-gray-700",
  PAID: "bg-blue-50 text-blue-800",
  PACKED: "bg-indigo-50 text-indigo-800",
  SHIPPED: "bg-amber-50 text-amber-800",
  DELIVERED: "bg-brand-50 text-brand-800",
  REFUNDED: "bg-red-50 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-600",
};
const LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PAID: "Order received",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  REFUNDED: "Refunded",
  CANCELLED: "Cancelled",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`badge ${STYLES[status]}`}>{LABELS[status]}</span>;
}

export function OrderTimeline({ order }: { order: { status: OrderStatus; paidAt: Date | null; packedAt: Date | null; shippedAt: Date | null; deliveredAt: Date | null } }) {
  const steps = [
    { label: "Order received", at: order.paidAt },
    { label: "Packed", at: order.packedAt },
    { label: "Shipped", at: order.shippedAt },
    { label: "Delivered", at: order.deliveredAt },
  ];
  if (order.status === "REFUNDED" || order.status === "CANCELLED") return <OrderStatusBadge status={order.status} />;
  const reached = steps.filter((s) => s.at).length;
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Order progress">
      {steps.map((s, i) => (
        <li key={s.label} className="text-center">
          <div className={`h-1.5 rounded-full ${i < reached ? "bg-brand-500" : "bg-line"}`} />
          <p className={`mt-2 text-xs ${i < reached ? "font-semibold" : "text-muted"}`}>{s.label}</p>
          {s.at && <p className="text-[11px] text-muted">{new Date(s.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>}
          <span className="sr-only">{i < reached ? "completed" : "not yet"}</span>
        </li>
      ))}
    </ol>
  );
}
