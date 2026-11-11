import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const shipment = await db.shipment.findUnique({ where: { orderId: id }, include: { order: { select: { number: true } } } });
  if (!shipment?.labelPdf) return NextResponse.json({ error: "No label" }, { status: 404 });
  return new NextResponse(new Uint8Array(shipment.labelPdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="label-CL-${10000 + shipment.order.number}.pdf"` },
  });
}
