import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type Granularity = "day" | "week" | "month";
const PAID_STATUSES = ["PAID", "PACKED", "SHIPPED", "DELIVERED"] as const;

export interface DashboardData {
  range: { from: Date; to: Date; days: number };
  kpis: {
    revenue: number;
    orders: number;
    aov: number;
    visitors: number;
    conversionRate: number;
    refunds: number;
    prev: { revenue: number; orders: number; aov: number; visitors: number; conversionRate: number };
  };
  series: { bucket: string; label: string; revenue: number; orders: number }[];
  topProducts: { productId: string | null; name: string; units: number; revenue: number }[];
  statusCounts: { status: string; count: number }[];
  funnel: { visitors: number; productViews: number; addToCart: number; checkout: number; purchases: number };
  lowStock: { id: string; sku: string; name: string; variant: string; stock: number; isPlaceholder: boolean }[];
}

function orderWhere(from: Date, to: Date, includeSeed: boolean): Prisma.OrderWhereInput {
  return { paidAt: { gte: from, lt: to }, status: { in: [...PAID_STATUSES] }, ...(includeSeed ? {} : { source: { not: "seed" } }) };
}

const seedHash = (includeSeed: boolean) => (includeSeed ? Prisma.empty : Prisma.sql`AND "visitorHash" NOT LIKE 'seed%'`);

async function periodKpis(from: Date, to: Date, includeSeed: boolean) {
  const [agg, visitorsRow] = await Promise.all([
    db.order.aggregate({ where: orderWhere(from, to, includeSeed), _sum: { total: true, giftCardTotal: true }, _count: true }),
    db.$queryRaw<{ n: bigint }[]>`SELECT COUNT(DISTINCT "visitorHash") AS n FROM "AnalyticsEvent" WHERE type = 'page_view' AND "createdAt" >= ${from} AND "createdAt" < ${to} ${seedHash(includeSeed)}`,
  ]);
  // Revenue = cash taken + gift card redemptions (gift card sales are not revenue until redeemed)
  const revenue = (agg._sum.total ?? 0) + (agg._sum.giftCardTotal ?? 0);
  const orders = agg._count;
  const visitors = Number(visitorsRow[0]?.n ?? 0);
  return { revenue, orders, aov: orders ? Math.round(revenue / orders) : 0, visitors, conversionRate: visitors ? orders / visitors : 0 };
}

export async function getDashboard(opts: { days: number; granularity: Granularity; includeSeed: boolean }): Promise<DashboardData> {
  const to = new Date();
  const from = new Date(to.getTime() - opts.days * 86400_000);
  const prevFrom = new Date(from.getTime() - opts.days * 86400_000);
  const seedFilter = opts.includeSeed ? "" : `AND source <> 'seed'`;

  const [cur, prev, refunds, series, top, statusCounts, funnelRows, lowStock] = await Promise.all([
    periodKpis(from, to, opts.includeSeed),
    periodKpis(prevFrom, from, opts.includeSeed),
    db.order.aggregate({ where: { refundedAt: { gte: from, lt: to }, ...(opts.includeSeed ? {} : { source: { not: "seed" } }) }, _sum: { total: true } }),
    db.$queryRawUnsafe<{ bucket: Date; revenue: bigint; orders: bigint }[]>(
      `SELECT date_trunc($1, "paidAt" AT TIME ZONE 'Europe/London') AS bucket,
              SUM(total + "giftCardTotal") AS revenue, COUNT(*) AS orders
       FROM "Order" WHERE "paidAt" >= $2 AND "paidAt" < $3
       AND status IN ('PAID','PACKED','SHIPPED','DELIVERED') ${seedFilter}
       GROUP BY 1 ORDER BY 1`,
      opts.granularity,
      from,
      to,
    ),
    db.$queryRawUnsafe<{ productId: string | null; name: string; units: bigint; revenue: bigint }[]>(
      `SELECT oi."productId", MAX(oi.name) AS name, SUM(oi.quantity) AS units, SUM(oi.quantity * oi."unitPrice") AS revenue
       FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
       WHERE o."paidAt" >= $1 AND o."paidAt" < $2 AND o.status IN ('PAID','PACKED','SHIPPED','DELIVERED') ${seedFilter.replace("source", "o.source")}
       GROUP BY oi."productId" ORDER BY revenue DESC LIMIT 8`,
      from,
      to,
    ),
    db.order.groupBy({ by: ["status"], where: { createdAt: { gte: from }, status: { not: "PENDING_PAYMENT" }, ...(opts.includeSeed ? {} : { source: { not: "seed" } }) }, _count: true }),
    db.$queryRaw<{ type: string; n: bigint }[]>`SELECT type, COUNT(DISTINCT "visitorHash") AS n FROM "AnalyticsEvent" WHERE "createdAt" >= ${from} AND "createdAt" < ${to} ${seedHash(opts.includeSeed)} GROUP BY type`,
    db.productVariant.findMany({
      where: { stock: { lte: 5 }, product: { status: "ACTIVE" } },
      orderBy: [{ stock: "asc" }],
      take: 12,
      include: { product: { select: { name: true, isPlaceholder: true } } },
    }),
  ]);

  // Fill empty buckets so the chart has a continuous x-axis
  const buckets: { bucket: string; label: string; revenue: number; orders: number }[] = [];
  const map = new Map(series.map((s) => [s.bucket.toISOString().slice(0, 10), s]));
  const cursor = new Date(from);
  cursor.setUTCHours(0, 0, 0, 0);
  if (opts.granularity === "week") cursor.setUTCDate(cursor.getUTCDate() - ((cursor.getUTCDay() + 6) % 7));
  if (opts.granularity === "month") cursor.setUTCDate(1);
  while (cursor <= to) {
    const key = cursor.toISOString().slice(0, 10);
    const row = map.get(key);
    buckets.push({
      bucket: key,
      label:
        opts.granularity === "month"
          ? cursor.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" })
          : cursor.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }),
      revenue: Number(row?.revenue ?? 0),
      orders: Number(row?.orders ?? 0),
    });
    if (opts.granularity === "day") cursor.setUTCDate(cursor.getUTCDate() + 1);
    else if (opts.granularity === "week") cursor.setUTCDate(cursor.getUTCDate() + 7);
    else cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  const f = (t: string) => Number(funnelRows.find((r) => r.type === t)?.n ?? 0);
  return {
    range: { from, to, days: opts.days },
    kpis: { ...cur, refunds: refunds._sum.total ?? 0, prev },
    series: buckets,
    topProducts: top.map((t) => ({ productId: t.productId, name: t.name, units: Number(t.units), revenue: Number(t.revenue) })),
    statusCounts: statusCounts.map((s) => ({ status: s.status, count: s._count })),
    funnel: { visitors: f("page_view"), productViews: f("product_view"), addToCart: f("add_to_cart"), checkout: f("checkout_started"), purchases: cur.orders },
    lowStock: lowStock.map((v) => ({ id: v.id, sku: v.sku, name: v.product.name, variant: v.name, stock: v.stock, isPlaceholder: v.product.isPlaceholder })),
  };
}
