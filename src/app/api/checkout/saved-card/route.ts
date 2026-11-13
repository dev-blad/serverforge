import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { handlePaymentIntentSucceeded } from "@/lib/payments";
import { absoluteUrl } from "@/lib/utils";

/**
 * One-click repeat checkout: charge a card the customer saved previously.
 * Confirms the order's PaymentIntent server-side; if the bank requires 3D Secure
 * the client finishes it with stripe.handleNextAction().
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { orderId, paymentMethodId } = z.object({ orderId: z.string(), paymentMethodId: z.string().startsWith("pm_") }).parse(await req.json());
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Payments are not configured." }, { status: 503 });

  const [order, user] = await Promise.all([
    db.order.findUnique({ where: { id: orderId } }),
    db.user.findUnique({ where: { id: session.user.id } }),
  ]);
  if (!order || order.userId !== session.user.id || order.status !== "PENDING_PAYMENT" || !order.stripePaymentIntentId) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
  if (!user?.stripeCustomerId || pm.customer !== user.stripeCustomerId) {
    return NextResponse.json({ error: "Card not found." }, { status: 404 });
  }

  try {
    const pi = await stripe.paymentIntents.confirm(order.stripePaymentIntentId, {
      payment_method: paymentMethodId,
      return_url: absoluteUrl(`/checkout/complete?order=${order.id}`),
    });
    if (pi.status === "succeeded") {
      await handlePaymentIntentSucceeded(pi);
      return NextResponse.json({ status: "paid", orderId: order.id });
    }
    return NextResponse.json({ status: pi.status, clientSecret: pi.client_secret, orderId: order.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Payment failed";
    return NextResponse.json({ error: message }, { status: 402 });
  }
}
