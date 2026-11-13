import { formatOrderNumber } from "@/lib/utils";
import { getOrdersToPack, pickList } from "@/lib/pack-summary";
import { PrintButton } from "@/components/ui/print-button";

export const metadata = { title: "Daily packing summary" };

export default async function SummaryPage() {
  const orders = await getOrdersToPack();
  const picks = pickList(orders);
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
  return (
    <div className="bg-white p-6 print:p-0">
      <div className="mb-4 print:hidden"><PrintButton /></div>
      <h1 className="text-2xl font-extrabold">Orders to pack — {today}</h1>
      <p className="text-sm">{orders.length} orders · {picks.reduce((s, p) => s + p.qty, 0)} items</p>
      <h2 className="mt-6 font-bold">Pick list</h2>
      <table className="mt-2 w-full text-sm">
        <tbody>{picks.map((p) => <tr key={p.sku} className="border-b"><td className="py-1">☐</td><td className="font-mono text-xs">{p.sku}</td><td>{p.name} — {p.variant}</td><td className="text-right font-bold">× {p.qty}</td></tr>)}</tbody>
      </table>
      <h2 className="mt-6 font-bold">Orders</h2>
      <table className="mt-2 w-full text-sm">
        <tbody>
          {orders.map((o) => {
            const a = o.shippingAddress as { name?: string; postcode?: string };
            return (
              <tr key={o.id} className="border-b align-top">
                <td className="py-1.5">☐</td>
                <td className="font-semibold">{formatOrderNumber(o.number)}</td>
                <td>{a.name}, {a.postcode}</td>
                <td>{o.items.map((i) => `${i.quantity}× ${i.name} (${i.variantName})`).join("; ")}</td>
                <td>{o.shippingMethod}</td>
                <td className="text-xs">{o.shipment?.trackingNumber ?? "no label"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
