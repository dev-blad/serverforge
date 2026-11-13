import { NextResponse } from "next/server";
import { z } from "zod";
import { features } from "@/lib/config";
import { db } from "@/lib/db";
import { loadCart } from "@/lib/cart";
import { afterOrderPaid, markOrderPaid } from "@/lib/orders";

/** Demo-only payment used when Stripe keys are not configured. Disabled automatically once Stripe is set up. */
export async function POST(req: Request) {
  if (!features.simulatedPayments) return NextResponse.json({ error: "Not available" }, { status: 404 });
  const { orderId, outcome } = z
    .object({ orderId: z.string(), outcome: z.enum(["success", "decline"]).default("success") })
    .parse(await req.json());
  const cart = await loadCart();
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || !cart || order.cartId !== cart.id) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (outcome === "decline") return NextResponse.json({ error: "Your card was declined (simulated). Try again." }, { status: 402 });
  if (await markOrderPaid(order.id, { provider: "simulated", summary: "Simulated VISA •••• 4242" })) {
    await afterOrderPaid(order.id);
  }
  return NextResponse.json({ status: "paid", orderId: order.id });
}
