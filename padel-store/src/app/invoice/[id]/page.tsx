import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { store } from "@/lib/config";
import { formatPrice, vatFromInclusive } from "@/lib/money";
import { formatDate, formatOrderNumber } from "@/lib/utils";
import { PrintButton } from "@/components/ui/print-button";

export const metadata = { title: "VAT invoice", robots: { index: false } };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) notFound();
  const order = await db.order.findUnique({ where: { id }, include: { items: true } });
  if (!order || (order.userId !== session.user.id && session.user.role !== "ADMIN") || order.status === "PENDING_PAYMENT") notFound();
  const a = order.shippingAddress as Record<string, string | undefined>;
  return (
    <main className="mx-auto max-w-3xl p-8 print:p-0">
      <div className="mb-6 flex justify-end print:hidden"><PrintButton /></div>
      <header className="flex justify-between">
        <div>
          <p className="text-2xl font-extrabold">{store.companyName}</p>
          <p className="text-sm text-muted">{store.address}<br />VAT reg. {store.vatNumber} · Company no. {store.companyNumber}</p>
        </div>
        <div className="text-right">
          <h1 className="text-xl font-bold">VAT invoice</h1>
          <p className="text-sm">Invoice {formatOrderNumber(order.number)}<br />Date {formatDate(order.paidAt ?? order.createdAt)}</p>
        </div>
      </header>
      <section className="mt-8 text-sm">
        <h2 className="font-semibold">Invoice to</h2>
        <p>{[a.name, a.line1, a.line2, a.city, a.county, a.postcode].filter(Boolean).join(", ")}<br />{order.email}</p>
      </section>
      <table className="mt-8 w-full text-sm">
        <thead><tr className="border-b-2 border-ink text-left"><th className="py-2">Item</th><th>Qty</th><th className="text-right">Unit (inc VAT)</th><th className="text-right">VAT 20%</th><th className="text-right">Total</th></tr></thead>
        <tbody>
          {order.items.map((i) => (
            <tr key={i.id} className="border-b border-line">
              <td className="py-2">{i.name}<br /><span className="text-xs text-muted">{i.variantName} · {i.sku}</span></td>
              <td>{i.quantity}</td>
              <td className="text-right">{formatPrice(i.unitPrice)}</td>
              <td className="text-right">{formatPrice(vatFromInclusive(i.unitPrice * i.quantity))}</td>
              <td className="text-right">{formatPrice(i.unitPrice * i.quantity)}</td>
            </tr>
          ))}
          {order.discountTotal > 0 && <tr><td colSpan={4} className="py-1 text-right">Discount {order.discountCode}</td><td className="text-right">−{formatPrice(order.discountTotal)}</td></tr>}
          <tr><td colSpan={4} className="py-1 text-right">Delivery ({order.shippingMethod})</td><td className="text-right">{formatPrice(order.shippingTotal)}</td></tr>
          <tr className="font-semibold"><td colSpan={4} className="py-1 text-right">Total (inc VAT)</td><td className="text-right">{formatPrice(order.total + order.giftCardTotal)}</td></tr>
          <tr><td colSpan={4} className="py-1 text-right">of which VAT @ 20%</td><td className="text-right">{formatPrice(order.taxTotal)}</td></tr>
          <tr><td colSpan={4} className="py-1 text-right">Net (ex VAT)</td><td className="text-right">{formatPrice(order.total + order.giftCardTotal - order.taxTotal)}</td></tr>
          {order.giftCardTotal > 0 && <tr><td colSpan={4} className="py-1 text-right">Paid by gift card</td><td className="text-right">−{formatPrice(order.giftCardTotal)}</td></tr>}
          <tr className="font-bold"><td colSpan={4} className="py-2 text-right">Amount paid</td><td className="text-right">{formatPrice(order.total)}</td></tr>
        </tbody>
      </table>
      <p className="mt-8 text-xs text-muted">Payment: {order.paymentMethodSummary ?? order.paymentProvider}. Thank you for your custom.</p>
    </main>
  );
}
