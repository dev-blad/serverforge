import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { renderPackingSlips } from "@/lib/fulfilment/pdf";
import { toSlipOrder } from "@/lib/fulfilment";

/** Packing slips PDF: ?ids=a,b,c or ?toPack=1 for every PAID/PACKED order. */
export async function GET(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const sp = new URL(req.url).searchParams;
  const ids = (sp.get("ids") ?? "").split(",").filter(Boolean);
  const orders = await db.order.findMany({
    where: sp.get("toPack") ? { status: { in: ["PAID", "PACKED"] } } : { id: { in: ids } },
    orderBy: { createdAt: "asc" },
    include: { items: true },
  });
  if (!orders.length) return NextResponse.json({ error: "No orders" }, { status: 404 });
  const pdf = await renderPackingSlips(orders.map(toSlipOrder));
  return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="packing-slips.pdf"' } });
}
