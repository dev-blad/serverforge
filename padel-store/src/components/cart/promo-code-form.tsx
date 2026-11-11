"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/components/providers/cart-provider";
import { formatPrice } from "@/lib/money";

export function PromoCodeForm() {
  const { cart, applyCode, removeCode } = useCart();
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!cart) return null;
  return (
    <div className="space-y-2">
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const r = await applyCode(code);
          setBusy(false);
          setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: r.applied === "giftcard" ? "Gift card applied" : "Discount applied" });
          if (!r.error) setCode("");
        }}
      >
        <label htmlFor="promo" className="sr-only">
          Discount or gift card code
        </label>
        <input id="promo" className="input uppercase" placeholder="Discount or gift card code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
        <button className="btn-outline shrink-0" disabled={busy || !code.trim()}>
          Apply
        </button>
      </form>
      {msg && (
        <p role="status" className={`text-xs ${msg.ok ? "text-brand-600" : "text-sale"}`}>
          {msg.text}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {cart.discountCode && (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800">
            {cart.discountCode}
            <button type="button" onClick={() => void removeCode("discount")} aria-label={`Remove code ${cart.discountCode}`}>
              <X className="size-3.5" aria-hidden />
            </button>
          </span>
        )}
        {cart.giftCardCode && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
            Gift card {cart.giftCardCode} ({formatPrice(cart.giftCardBalance)} balance)
            <button type="button" onClick={() => void removeCode("giftcard")} aria-label="Remove gift card">
              <X className="size-3.5" aria-hidden />
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
