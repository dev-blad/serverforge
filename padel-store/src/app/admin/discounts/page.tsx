import { db } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { createGiftCard, saveDiscount, toggleDiscount } from "@/app/actions/admin-misc";
import { ActionForm } from "@/components/admin/action-form";
import { PageHeader, Panel, Table } from "@/components/admin/ui";

export const metadata = { title: "Discounts & gift cards" };

export default async function DiscountsPage() {
  const [discounts, giftCards] = await Promise.all([db.discount.findMany({ orderBy: { createdAt: "desc" } }), db.giftCard.findMany({ orderBy: { createdAt: "desc" } })]);
  const now = new Date();
  return (
    <div className="space-y-6">
      <PageHeader title="Discounts & gift cards" />
      <Panel title="Discount codes">
        <Table head={["Code", "Type", "Value", "Min spend", "Used", "Ends", "Status", ""]}>
          {discounts.map((d) => {
            const expired = d.endsAt && d.endsAt < now;
            return (
              <tr key={d.id}>
                <td className="px-2 py-2 font-mono font-semibold">{d.code}<br /><span className="font-sans text-xs font-normal text-muted">{d.description}</span></td>
                <td className="px-2 text-xs">{d.type.replace("_", " ").toLowerCase()}</td>
                <td className="px-2">{d.type === "PERCENT" ? `${d.value}%` : d.type === "FIXED" ? formatPrice(d.value) : "Free delivery"}</td>
                <td className="px-2">{d.minSubtotal ? formatPrice(d.minSubtotal) : "—"}</td>
                <td className="px-2">{d.usageCount}{d.usageLimit ? ` / ${d.usageLimit}` : ""}</td>
                <td className="px-2 text-xs">{d.endsAt ? formatDate(d.endsAt) : "—"}</td>
                <td className="px-2 text-xs font-semibold">{expired ? <span className="text-muted">expired</span> : d.active ? <span className="text-brand-600">active</span> : <span className="text-muted">paused</span>}</td>
                <td className="px-2"><form action={toggleDiscount}><input type="hidden" name="id" value={d.id} /><button className="text-xs underline">{d.active ? "Pause" : "Activate"}</button></form></td>
              </tr>
            );
          })}
        </Table>
        <h3 className="mt-6 mb-3 text-sm font-bold">Create discount</h3>
        <ActionForm action={saveDiscount} submitLabel="Create code" buttonClass="btn-primary btn-sm mt-3">
          <div className="grid gap-3 md:grid-cols-4">
            <div><label className="label" htmlFor="d-code">Code</label><input id="d-code" name="code" required className="input uppercase" /></div>
            <div><label className="label" htmlFor="d-type">Type</label><select id="d-type" name="type" className="input"><option value="PERCENT">% off</option><option value="FIXED">£ off</option><option value="FREE_SHIPPING">Free delivery</option></select></div>
            <div><label className="label" htmlFor="d-value">Value (% or £)</label><input id="d-value" name="value" className="input" /></div>
            <div><label className="label" htmlFor="d-min">Min spend (£)</label><input id="d-min" name="minSubtotal" className="input" /></div>
            <div className="md:col-span-2"><label className="label" htmlFor="d-desc">Description</label><input id="d-desc" name="description" className="input" /></div>
            <div><label className="label" htmlFor="d-limit">Usage limit</label><input id="d-limit" name="usageLimit" type="number" className="input" /></div>
            <div><label className="label" htmlFor="d-ends">Ends on</label><input id="d-ends" name="endsAt" type="date" className="input" /></div>
          </div>
        </ActionForm>
      </Panel>
      <Panel title="Gift cards (placeholder — online purchase coming soon)">
        <p className="mb-3 text-sm text-muted">Issue cards manually for prizes, refunds-as-credit or club orders. Customers redeem them in the basket; partial balances carry over.</p>
        <Table head={["Code", "Balance", "Issued", "Expires", "Note"]}>
          {giftCards.map((g) => (
            <tr key={g.id}>
              <td className="px-2 py-2 font-mono font-semibold">{g.code}</td>
              <td className="px-2">{formatPrice(g.balance)} <span className="text-xs text-muted">of {formatPrice(g.initialBalance)}</span></td>
              <td className="px-2 text-xs">{formatDate(g.createdAt)}</td>
              <td className="px-2 text-xs">{g.expiresAt ? formatDate(g.expiresAt) : "—"}</td>
              <td className="px-2 text-xs">{g.note}</td>
            </tr>
          ))}
        </Table>
        <ActionForm action={createGiftCard} submitLabel="Issue gift card" buttonClass="btn-primary btn-sm" className="mt-4 flex flex-wrap items-end gap-2">
          <div><label className="label" htmlFor="g-amt">Amount (£)</label><input id="g-amt" name="amount" required className="input w-32" /></div>
          <div><label className="label" htmlFor="g-note">Note</label><input id="g-note" name="note" className="input" /></div>
        </ActionForm>
      </Panel>
    </div>
  );
}
