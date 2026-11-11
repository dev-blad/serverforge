import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { features } from "@/lib/config";
import { formatPrice } from "@/lib/money";
import { formatDate, formatOrderNumber } from "@/lib/utils";
import { allowedTransitions } from "@/lib/orders";
import { PageHeader, Panel } from "@/components/admin/ui";
import { OrderStatusBadge, OrderTimeline } from "@/components/account/order-status-badge";
import { ActionForm } from "@/components/admin/action-form";
import { addOrderNote, changeOrderStatus, createLabelAction, printDocsAction, rerunFulfilment, resendConfirmation } from "@/app/actions/admin-orders";

export default async function AdminOrder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: { items: true, events: { orderBy: { createdAt: "desc" } }, shipment: { select: { status: true, provider: true, service: true, trackingNumber: true, error: true, printJobId: true, printedAt: true, labelPdf: false, updatedAt: true } }, user: { select: { id: true, name: true, email: true } } },
  });
  if (!order) notFound();
  const hasLabel = Boolean(await db.shipment.count({ where: { orderId: id, labelPdf: { not: null } } }));
  const a = order.shippingAddress as Record<string, string | undefined>;
  const next = allowedTransitions(order.status);
  const hidden = <input type="hidden" name="orderId" value={order.id} />;

  return (
    <div>
      <PageHeader
        title={`Order ${formatOrderNumber(order.number)}`}
        description={`Placed ${formatDate(order.createdAt, { dateStyle: "full", timeStyle: "short" })}${order.source === "seed" ? " · seeded demo order" : ""}`}
        actions={<><OrderStatusBadge status={order.status} /><Link href={`/invoice/${order.id}`} target="_blank" className="btn-outline btn-sm">VAT invoice</Link></>}
      />
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Panel title="Progress"><OrderTimeline order={order} /></Panel>

          <Panel title="Status workflow">
            {next.length === 0 ? (
              <p className="text-sm text-muted">This order is closed.</p>
            ) : (
              <div className="flex flex-wrap items-start gap-3">
                {next.map((s) => (
                  <ActionForm
                    key={s}
                    action={changeOrderStatus}
                    submitLabel={`Mark ${s.toLowerCase()}`}
                    buttonClass={s === "REFUNDED" || s === "CANCELLED" ? "btn btn-sm border border-red-200 text-sale hover:bg-red-50" : "btn-primary btn-sm"}
                    confirm={s === "REFUNDED" ? `Refund ${formatPrice(order.total)} to the customer${order.paymentProvider === "stripe" ? " via Stripe" : ""}?` : s === "CANCELLED" ? "Cancel this order and refund any payment?" : undefined}
                    className="flex flex-col gap-1"
                  >
                    {hidden}
                    <input type="hidden" name="status" value={s} />
                    {s === "SHIPPED" && !order.trackingNumber && <input name="trackingNumber" placeholder="Tracking no. (optional)" className="input py-1.5 text-xs" aria-label="Tracking number" />}
                  </ActionForm>
                ))}
              </div>
            )}
            <p className="mt-3 text-xs text-muted">Marking shipped emails the customer their tracking link. Refunds go back to the original payment method and restock the items.</p>
          </Panel>

          <Panel title="Items">
            <ul className="divide-y divide-line">
              {order.items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-3">
                  <div className="relative size-12 shrink-0 overflow-hidden rounded bg-canvas">{i.image && <Image src={i.image} alt="" fill sizes="48px" unoptimized />}</div>
                  <div className="flex-1 text-sm">
                    {i.productId ? <Link href={`/admin/products/${i.productId}`} className="font-semibold hover:underline">{i.name}</Link> : <span className="font-semibold">{i.name}</span>}
                    <p className="text-xs text-muted">{i.variantName} · {i.sku}</p>
                  </div>
                  <span className="text-sm">{i.quantity} × {formatPrice(i.unitPrice)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
              {[
                ["Subtotal", formatPrice(order.subtotal)],
                ...(order.discountTotal ? [[`Discount (${order.discountCode})`, `−${formatPrice(order.discountTotal)}`]] : []),
                [`Shipping (${order.shippingMethod})`, formatPrice(order.shippingTotal)],
                ...(order.giftCardTotal ? [[`Gift card (${order.giftCardCode})`, `−${formatPrice(order.giftCardTotal)}`]] : []),
                ["Total charged", formatPrice(order.total)],
                ["VAT included", formatPrice(order.taxTotal)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between"><dt className="text-muted">{k}</dt><dd className="font-semibold">{v}</dd></div>
              ))}
            </dl>
            <p className="mt-2 text-xs text-muted">Payment: {order.paymentMethodSummary ?? order.paymentProvider}{order.stripePaymentIntentId && <> · <a className="underline" href={`https://dashboard.stripe.com/${process.env.STRIPE_SECRET_KEY?.startsWith("sk_test") ? "test/" : ""}payments/${order.stripePaymentIntentId}`} target="_blank" rel="noopener noreferrer">View in Stripe</a></>}</p>
          </Panel>

          <Panel title="Activity">
            <ActionForm action={addOrderNote} submitLabel="Add note" className="mb-4 flex gap-2">
              {hidden}
              <input name="note" placeholder="Internal note…" className="input" aria-label="Internal note" />
            </ActionForm>
            <ol className="space-y-3">
              {order.events.map((e) => (
                <li key={e.id} className="flex gap-3 text-sm">
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${e.type === "error" || e.type === "warning" ? "bg-sale" : "bg-brand-500"}`} aria-hidden />
                  <div><p>{e.message}</p><p className="text-xs text-muted">{formatDate(e.createdAt, { dateStyle: "medium", timeStyle: "short" })} · {e.type}</p></div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Customer">
            <p className="text-sm font-semibold">{a.name}</p>
            <p className="text-sm"><a href={`mailto:${order.email}`} className="text-brand-700 underline">{order.email}</a></p>
            {a.phone && <p className="text-sm">{a.phone}</p>}
            <p className="mt-1 text-xs text-muted">{order.user ? <>Registered customer</> : "Guest checkout"}</p>
            <h3 className="mt-4 text-sm font-semibold">Ship to</h3>
            <address className="text-sm not-italic">{[a.line1, a.line2, a.city, a.county, a.postcode].filter(Boolean).map((l) => <span key={l} className="block">{l}</span>)}</address>
            {order.customerNote && <p className="mt-3 rounded bg-amber-50 p-2 text-sm"><strong>Note:</strong> {order.customerNote}</p>}
          </Panel>

          <Panel title="Shipping label & printing">
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Provider</dt><dd>{order.shipment?.provider ?? features.shippingProvider}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Service</dt><dd>{order.shipment?.service ?? order.shippingMethod}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Tracking</dt><dd>{order.trackingNumber ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Status</dt><dd>{order.shipment?.status ?? "No label yet"}</dd></div>
              {order.shipment?.printJobId && <div className="flex justify-between"><dt className="text-muted">Print job</dt><dd>#{order.shipment.printJobId}</dd></div>}
            </dl>
            {order.shipment?.error && <p className="mt-2 rounded bg-red-50 p-2 text-xs text-sale">{order.shipment.error}</p>}
            {order.status !== "PENDING_PAYMENT" && order.status !== "CANCELLED" && (
              <div className="mt-4 flex flex-wrap gap-2">
                <ActionForm action={createLabelAction} submitLabel={hasLabel ? "Recreate label" : "Create label"} confirm={hasLabel ? "Create a new label? The old one should be voided with your carrier." : undefined}>
                  {hidden}
                  {hasLabel && <input type="hidden" name="force" value="1" />}
                </ActionForm>
                {hasLabel && (
                  <>
                    <a href={`/api/admin/orders/${order.id}/label`} target="_blank" className="btn-outline btn-sm">Download label</a>
                    <ActionForm action={printDocsAction} submitLabel={features.printNode ? "Print label + slip" : "Print (PrintNode off)"}>{hidden}</ActionForm>
                  </>
                )}
                <a href={`/api/admin/packing-slips?ids=${order.id}`} target="_blank" className="btn-outline btn-sm">Packing slip PDF</a>
              </div>
            )}
          </Panel>

          <Panel title="Emails & automation">
            <div className="flex flex-wrap gap-2">
              <ActionForm action={resendConfirmation} submitLabel="Resend confirmation">{hidden}</ActionForm>
              <ActionForm action={rerunFulfilment} submitLabel="Re-run post-payment steps" confirm="Re-send confirmation and (re)create the label if missing?">{hidden}</ActionForm>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
