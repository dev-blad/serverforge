"use client";

import Link from "next/link";
import { ShoppingBag, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useCart } from "@/components/providers/cart-provider";
import { CartLines } from "./cart-lines";
import { FreeShippingBar } from "./free-shipping-bar";
import { formatPrice } from "@/lib/money";

export function CartDrawer() {
  const { cart, open, setOpen } = useCart();
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Tab" && panelRef.current) {
        const f = panelRef.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled]),input");
        if (!f.length) return;
        const first = f[0]!, last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus();
    };
  }, [open, setOpen]);

  if (!open) return null;
  const items = cart?.items ?? [];

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="cart-title" className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id="cart-title" className="text-lg font-bold">
            Your basket {cart?.itemCount ? `(${cart.itemCount})` : ""}
          </h2>
          <button ref={closeRef} type="button" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-full hover:bg-canvas" aria-label="Close basket">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <ShoppingBag className="size-10 text-muted" aria-hidden />
            <p className="font-semibold">Your basket is empty</p>
            <Link href="/c/rackets" className="btn-primary" onClick={() => setOpen(false)}>
              Shop rackets
            </Link>
          </div>
        ) : (
          <>
            <div className="px-5 pt-4">
              <FreeShippingBar remaining={cart!.totals.freeShippingRemaining} />
            </div>
            <div className="flex-1 overflow-y-auto px-5">
              <CartLines items={items} compact />
            </div>
            <div className="space-y-3 border-t border-line p-5">
              {cart!.messages.map((m) => (
                <p key={m} className="text-xs text-sale">{m}</p>
              ))}
              <div className="flex justify-between font-semibold">
                <span>Subtotal</span>
                <span>{formatPrice(cart!.totals.subtotal - cart!.totals.discountTotal)}</span>
              </div>
              <p className="text-xs text-muted">Delivery, discounts and gift cards calculated at checkout.</p>
              <Link href="/checkout" className="btn-primary w-full" onClick={() => setOpen(false)}>
                Checkout securely
              </Link>
              <Link href="/cart" className="btn-outline w-full" onClick={() => setOpen(false)}>
                View basket
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
