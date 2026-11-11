import Link from "next/link";
import { features } from "@/lib/config";
import { formatDate, formatOrderNumber } from "@/lib/utils";
import { getOrdersToPack, pickList } from "@/lib/pack-summary";
import { bulkStatus } from "@/app/actions/admin-orders";
import { PageHeader, Panel, Table } from "@/components/admin/ui";
import { OrderStatusBadge } from "@/components/account/order-status-badge";

export const metadata = { title: "Fulfilment" };

export default async function FulfilmentPage() {
  const orders = await getOrdersToPack();
  const picks = pickList(orders);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders to pack"
        description={`${orders.length} order(s) waiting · labels via ${features.shippingProvider}${features.printNode ? " · auto-printing via PrintNode" : " · PrintNode not connected"}`}
        actions={
          <>
            <a href="/api/admin/packing-slips?toPack=1" target="_blank" className="btn-outline btn-sm">All packing slips (PDF)</a>
            <Link href="/admin/fulfilment/summary" target="_blank" className="btn-primary btn-sm">Printable daily summary</Link>
          </>
        }
      />
      <form action={bulkStatus}>
        <Panel title="Queue (oldest first)">
          <Table head={["", "Order", "Paid", "Customer", "Items", "Service", "Label", "Status"]}>
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="px-2"><input type="checkbox" name="ids" value={o.id} aria-label={`Select ${formatOrderNumber(o.number)}`} className="size-4 accent-brand-900" /></td>
                <td className="px-2 py-2 font-semibold"><Link href={`/admin/orders/${o.id}`} className="hover:underline">{formatOrderNumber(o.number)}</Link></td>
                <td className="px-2 text-xs">{o.paidAt ? formatDate(o.paidAt, { dateStyle: "short", timeStyle: "short" }) : ""}</td>
                <td className="px-2">{(o.shippingAddress as { name?: string; postcode?: string }).name}<br /><span className="text-xs text-muted">{(o.shippingAddress as { postcode?: string }).postcode}</span></td>
                <td className="px-2 text-xs">{o.items.map((i) => `${i.quantity}× ${i.name} (${i.variantName})`).join(", ")}</td>
                <td className="px-2 text-xs">{o.shippingMethod}</td>
                <td className="px-2 text-xs">
                  {o.shipment?.status === "FAILED" ? <span className="text-sale" title={o.shipment.error ?? ""}>failed</span> : o.shipment ? <a href={`/api/admin/orders/${o.id}/label`} target="_blank" className="underline">{o.shipment.printedAt ? "printed" : "download"}</a> : "—"}
                </td>
                <td className="px-2"><OrderStatusBadge status={o.status} /></td>
              </tr>
            ))}
          </Table>
          {orders.length === 0 && <p className="p-4 text-sm text-muted">All caught up 🎉</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button name="status" value="PACKED" className="btn-outline btn-sm">Mark selected packed</button>
            <button name="status" value="SHIPPED" className="btn-primary btn-sm">Mark selected shipped (emails tracking)</button>
          </div>
        </Panel>
      </form>
      <Panel title="Pick list">
        <Table head={["SKU", "Product", "Option", "Qty"]}>
          {picks.map((p) => (
            <tr key={p.sku}><td className="px-2 py-1.5 font-mono text-xs">{p.sku}</td><td className="px-2">{p.name}</td><td className="px-2">{p.variant}</td><td className="px-2 font-bold">{p.qty}</td></tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
