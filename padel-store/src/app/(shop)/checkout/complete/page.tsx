import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { CheckCircle2 } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { CART_COOKIE } from "@/lib/cart";
import { getStripe } from "@/lib/stripe";
import { handlePaymentIntentSucceeded } from "@/lib/payments";
import { formatOrderNumber, addWorkingDaysLabel } from "./helpers";
import { OrderDetail } from "@/components/account/order-detail";
import { RefreshCart } from "./refresh-cart";

export const metadata: Metadata = { title: "Order confirmed", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ order?: string; payment_intent?: string; redirect_status?: string }> };

export default async function CompletePage({ searchParams }: Props) {
  const sp = await searchParams;
  const [session, jar] = await Promise.all([auth(), cookies()]);
  let order = sp.order ? await db.order.findUnique({ where: { id: sp.order }, include: { items: true } }) : null;
  const cartToken = jar.get(CART_COOKIE)?.value;
  const cart = cartToken ? await db.cart.findUnique({ where: { token: cartToken } }) : null;
  const allowed = order && ((session?.user?.id && order.userId === session.user.id) || (cart && order.cartId === cart.id));

  if (!order || !allowed) {
    return (
      <div className="container-page py-16 text-center">
        <h1 className="text-2xl font-extrabold">Thanks for your order</h1>
        <p className="mt-2 text-muted">You&apos;ll receive a confirmation email shortly. You can also <Link href="/track" className="underline">track your order</Link>.</p>
      </div>
    );
  }

  // Webhooks can lag a few seconds — if Stripe says the payment succeeded, confirm it now (idempotent).
  const stripe = getStripe();
  if (order.status === "PENDING_PAYMENT" && stripe && order.stripePaymentIntentId) {
    const pi = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
    if (pi.status === "succeeded") {
      await handlePaymentIntentSucceeded(pi);
      order = await db.order.findUnique({ where: { id: order.id }, include: { items: true } });
    }
  }
  const o = order as NonNullable<typeof order> & { items: import("@prisma/client").OrderItem[] };

  if (o.status === "PENDING_PAYMENT") {
    return (
      <div className="container-page py-16 text-center">
        <h1 className="text-2xl font-extrabold">{sp.redirect_status === "failed" ? "Payment wasn't completed" : "Confirming your payment…"}</h1>
        <p className="mt-2 text-muted">
          {sp.redirect_status === "failed" ? "No money has been taken. Please try again." : "This usually takes a few seconds. Refresh this page in a moment."}
        </p>
        <Link href="/checkout" className="btn-primary mt-6">Back to checkout</Link>
      </div>
    );
  }

  return (
    <div className="container-page py-10">
      <RefreshCart />
      <div className="mx-auto max-w-4xl">
        <div className="card flex flex-col items-center p-8 text-center">
          <CheckCircle2 className="size-12 text-brand-500" aria-hidden />
          <h1 className="mt-3 text-3xl font-extrabold">Thank you — order confirmed!</h1>
          <p className="mt-2 text-muted">
            Order <strong className="text-ink">{formatOrderNumber(o.number)}</strong>. A confirmation has been sent to <strong className="text-ink">{o.email}</strong>.
          </p>
          <p className="mt-1 text-sm text-muted">{addWorkingDaysLabel(o.createdAt)}</p>
          {!session?.user && (
            <div className="mt-6 rounded-lg bg-brand-50 p-4 text-sm">
              <p className="font-semibold">Save your details for next time</p>
              <p className="mt-1 text-muted">Create an account to track this order, save your address and pay in one tap next time.</p>
              <Link href={`/account/register?email=${encodeURIComponent(o.email)}`} className="btn-primary btn-sm mt-3">Create account</Link>
            </div>
          )}
        </div>
        <div className="mt-8">
          <OrderDetail order={o} />
        </div>
      </div>
    </div>
  );
}
