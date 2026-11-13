import type { Totals } from "@/lib/pricing";
import { formatPrice } from "@/lib/money";

export function CartSummary({ totals, shippingLabel = "Delivery", estimate = false }: { totals: Totals; shippingLabel?: string; estimate?: boolean }) {
  const row = (label: string, value: string, cls = "") => (
    <div className={`flex justify-between text-sm ${cls}`}>
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
  return (
    <dl className="space-y-2">
      {row("Subtotal", formatPrice(totals.subtotal))}
      {totals.discountTotal > 0 && row("Discount", `−${formatPrice(totals.discountTotal)}`, "text-brand-600")}
      {row(shippingLabel, totals.shippingTotal === 0 ? "Free" : `${formatPrice(totals.shippingTotal)}${estimate ? " (from)" : ""}`)}
      {totals.giftCardTotal > 0 && row("Gift card", `−${formatPrice(totals.giftCardTotal)}`, "text-brand-600")}
      <div className="flex justify-between border-t border-line pt-3 text-base font-bold">
        <dt>Total</dt>
        <dd>{formatPrice(totals.total)}</dd>
      </div>
      <p className="text-xs text-muted">Includes VAT of {formatPrice(totals.taxTotal)}</p>
    </dl>
  );
}
