import Link from "next/link";
import { getDashboard, type Granularity } from "@/lib/admin-analytics";
import { formatPrice } from "@/lib/money";
import { PageHeader, Panel, PlaceholderBadge } from "@/components/admin/ui";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { OrderStatusBadge } from "@/components/account/order-status-badge";
import type { OrderStatus } from "@prisma/client";
import { features } from "@/lib/config";

export const metadata = { title: "Admin dashboard" };

type Props = { searchParams: Promise<{ days?: string; g?: string; seed?: string }> };

function Delta({ cur, prev, pct = false }: { cur: number; prev: number; pct?: boolean }) {
  if (!prev) return <span className="text-xs text-muted">no prior data</span>;
  const change = (cur - prev) / prev;
  const up = change >= 0;
  return (
    <span className={`text-xs font-semibold ${up ? "text-brand-600" : "text-sale"}`}>
      {up ? "▲" : "▼"} {Math.abs(change * 100).toFixed(pct ? 1 : 0)}% <span className="font-normal text-muted">vs previous period</span>
    </span>
  );
}

export default async function AdminDashboard({ searchParams }: Props) {
  const sp = await searchParams;
  const days = [7, 30, 90, 365].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const g: Granularity = sp.g === "week" || sp.g === "month" ? sp.g : days > 90 ? "month" : "day";
  const includeSeed = sp.seed !== "0";
  const d = await getDashboard({ days, granularity: g, includeSeed });
  const q = (o: Record<string, string | number>) => `/admin?${new URLSearchParams({ days: String(days), g, seed: includeSeed ? "1" : "0", ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v)])) })}`;

  const kpis = [
    { label: "Revenue", value: formatPrice(d.kpis.revenue), cur: d.kpis.revenue, prev: d.kpis.prev.revenue },
    { label: "Orders", value: d.kpis.orders.toLocaleString("en-GB"), cur: d.kpis.orders, prev: d.kpis.prev.orders },
    { label: "Average order value", value: formatPrice(d.kpis.aov), cur: d.kpis.aov, prev: d.kpis.prev.aov },
    { label: "Conversion rate", value: `${(d.kpis.conversionRate * 100).toFixed(2)}%`, cur: d.kpis.conversionRate, prev: d.kpis.prev.conversionRate },
    { label: "Unique visitors", value: d.kpis.visitors.toLocaleString("en-GB"), cur: d.kpis.visitors, prev: d.kpis.prev.visitors },
  ];
  const funnel = [
    ["Visitors", d.funnel.visitors],
    ["Viewed a product", d.funnel.productViews],
    ["Added to basket", d.funnel.addToCart],
    ["Started checkout", d.funnel.checkout],
    ["Purchased", d.funnel.purchases],
  ] as const;
  const maxTop = Math.max(1, ...d.topProducts.map((t) => t.revenue));

  return (
    <div>
      <PageHeader
        title="Sales dashboard"
        description={`${d.range.from.toLocaleDateString("en-GB")} – ${d.range.to.toLocaleDateString("en-GB")} · revenue includes VAT · first-party cookieless analytics`}
      />
      <div className="mb-6 flex flex-wrap items-center gap-2" role="toolbar" aria-label="Dashboard filters">
        {[7, 30, 90, 365].map((n) => (
          <Link key={n} href={q({ days: n, g: n > 90 ? "month" : n > 30 ? "week" : "day" })} aria-current={n === days ? "true" : undefined} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${n === days ? "bg-brand-900 text-white" : "bg-white ring-1 ring-line"}`}>
            {n === 365 ? "12 months" : `${n} days`}
          </Link>
        ))}
        <span className="mx-2 h-5 w-px bg-line" aria-hidden />
        {(["day", "week", "month"] as const).map((x) => (
          <Link key={x} href={q({ g: x })} aria-current={x === g ? "true" : undefined} className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${x === g ? "bg-brand-900 text-white" : "bg-white ring-1 ring-line"}`}>
            By {x}
          </Link>
        ))}
        <span className="mx-2 h-5 w-px bg-line" aria-hidden />
        <Link href={q({ seed: includeSeed ? 0 : 1 })} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold ring-1 ring-line">
          {includeSeed ? "☑ Including seeded demo data" : "☐ Real orders only"}
        </Link>
      </div>

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k) => (
          <li key={k.label} className="card p-4">
            <p className="text-xs font-semibold text-muted">{k.label}</p>
            <p className="mt-1 text-2xl font-extrabold">{k.value}</p>
            <Delta cur={k.cur} prev={k.prev} pct={k.label === "Conversion rate"} />
          </li>
        ))}
      </ul>

      <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Panel title={`Revenue by ${g}`}>
          <RevenueChart data={d.series} />
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-semibold text-brand-700">Show as table</summary>
            <table className="mt-2 w-full text-xs">
              <thead><tr className="text-left text-muted"><th className="py-1">Period</th><th>Orders</th><th className="text-right">Revenue</th></tr></thead>
              <tbody>
                {d.series.map((s) => (
                  <tr key={s.bucket} className="border-t border-line"><td className="py-1">{s.label}</td><td>{s.orders}</td><td className="text-right">{formatPrice(s.revenue)}</td></tr>
                ))}
              </tbody>
            </table>
          </details>
        </Panel>
        <Panel title="Conversion funnel">
          <ol className="space-y-3">
            {funnel.map(([label, n], i) => {
              const pct = d.funnel.visitors ? (n / d.funnel.visitors) * 100 : 0;
              return (
                <li key={label}>
                  <div className="flex justify-between text-sm"><span>{label}</span><span className="font-semibold">{n.toLocaleString("en-GB")} <span className="text-xs font-normal text-muted">{i > 0 ? `${pct.toFixed(1)}%` : ""}</span></span></div>
                  <div className="mt-1 h-2 rounded bg-canvas"><div className="h-full rounded bg-brand-500" style={{ width: `${Math.max(pct, n ? 1 : 0)}%` }} /></div>
                </li>
              );
            })}
          </ol>
          <p className="mt-4 text-xs text-muted">
            Traffic sources & devices: {features.plausibleDomain ? <a className="underline" href={`https://plausible.io/${features.plausibleDomain}`}>Plausible</a> : "Vercel Web Analytics (project dashboard)"} — only for visitors who accept analytics cookies.
          </p>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Top products" className="xl:col-span-2">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted uppercase"><th className="py-2">Product</th><th>Units</th><th className="w-1/3">Revenue</th></tr></thead>
            <tbody>
              {d.topProducts.map((t) => (
                <tr key={t.productId ?? t.name} className="border-t border-line">
                  <td className="py-2 pr-2">{t.productId ? <Link className="hover:underline" href={`/admin/products/${t.productId}`}>{t.name}</Link> : t.name}</td>
                  <td>{t.units}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded bg-canvas"><div className="h-full rounded bg-brand-500" style={{ width: `${(t.revenue / maxTop) * 100}%` }} /></div>
                      <span className="w-20 text-right text-xs font-semibold">{formatPrice(t.revenue)}</span>
                    </div>
                  </td>
                </tr>
              ))}
              {d.topProducts.length === 0 && <tr><td colSpan={3} className="py-4 text-muted">No sales in this period yet.</td></tr>}
            </tbody>
          </table>
        </Panel>
        <div className="space-y-6">
          <Panel title="Orders by status">
            <ul className="space-y-2">
              {d.statusCounts.map((s) => (
                <li key={s.status} className="flex items-center justify-between text-sm">
                  <Link href={`/admin/orders?status=${s.status}`}><OrderStatusBadge status={s.status as OrderStatus} /></Link>
                  <span className="font-semibold">{s.count}</span>
                </li>
              ))}
            </ul>
            {d.kpis.refunds > 0 && <p className="mt-3 text-xs text-muted">Refunded in period: {formatPrice(d.kpis.refunds)}</p>}
          </Panel>
          <Panel title="Low stock" actions={<Link href="/admin/stock" className="text-xs font-semibold text-brand-700 underline">Manage stock</Link>}>
            <ul className="space-y-1.5 text-sm">
              {d.lowStock.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{v.name} <span className="text-muted">· {v.variant}</span> {v.isPlaceholder && <PlaceholderBadge />}</span>
                  <span className={`font-semibold ${v.stock <= 0 ? "text-sale" : "text-amber-700"}`}>{v.stock}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
