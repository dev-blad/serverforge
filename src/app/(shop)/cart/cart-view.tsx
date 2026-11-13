"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { useCart } from "@/components/providers/cart-provider";
import { CartLines } from "@/components/cart/cart-lines";
import { FreeShippingBar } from "@/components/cart/free-shipping-bar";
import { PromoCodeForm } from "@/components/cart/promo-code-form";
import { CartSummary } from "@/components/cart/cart-summary";

export function CartView() {
  const { cart, loading } = useCart();
  if (loading)
    return (
      <div className="mt-6" aria-busy="true">
        <p className="sr-only">Loading your basket…</p>
        <div className="h-72 animate-pulse rounded-xl bg-canvas" />
      </div>
    );
  if (!cart?.items.length)
    return (
      <div className="card mt-6 flex min-h-72 flex-col items-center justify-center p-10 text-center">
        <p className="text-lg font-semibold">Your basket is empty</p>
        <p className="mt-1 text-muted">Let&apos;s find you some kit.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/c/rackets" className="btn-primary">Shop rackets</Link>
          <Link href="/c/balls" className="btn-outline">Shop balls</Link>
        </div>
      </div>
    );
  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
      <div>
        <FreeShippingBar remaining={cart.totals.freeShippingRemaining} />
        {cart.messages.map((m) => (
          <p key={m} role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-sale">{m}</p>
        ))}
        <CartLines items={cart.items} />
      </div>
      <aside className="card h-fit space-y-5 p-6 lg:sticky lg:top-32" aria-label="Order summary">
        <h2 className="text-lg font-bold">Order summary</h2>
        <PromoCodeForm />
        <CartSummary totals={cart.totals} estimate />
        <Link href="/checkout" className="btn-primary w-full text-base">
          <Lock className="size-4" aria-hidden /> Checkout securely
        </Link>
        <p className="text-center text-xs text-muted">Apple Pay · Google Pay · Link · all major cards</p>
      </aside>
    </div>
  );
}
