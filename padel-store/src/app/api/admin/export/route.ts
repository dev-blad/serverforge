import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const csv = (rows: (string | number | null)[][]) =>
  rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");

/** CSV exports: ?type=subscribers | orders */
export async function GET(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const type = new URL(req.url).searchParams.get("type");
  let body = "";
  if (type === "subscribers") {
    const subs = await db.newsletterSubscriber.findMany({ orderBy: { createdAt: "asc" } });
    body = csv([["email", "source", "subscribed_at"], ...subs.map((s) => [s.email, s.source, s.createdAt.toISOString()])]);
  } else {
    const orders = await db.order.findMany({ where: { status: { not: "PENDING_PAYMENT" } }, orderBy: { createdAt: "asc" } });
    body = csv([["order", "date", "email", "status", "subtotal", "discount", "shipping", "vat", "total", "source"], ...orders.map((o) => [`CL-${10000 + o.number}`, o.createdAt.toISOString(), o.email, o.status, o.subtotal / 100, o.discountTotal / 100, o.shippingTotal / 100, o.taxTotal / 100, o.total / 100, o.source])]);
  }
  return new NextResponse(body, { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="${type ?? "orders"}.csv"` } });
}
