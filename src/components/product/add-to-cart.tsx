"use client";

import { Check, Minus, Plus } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { useCart } from "@/components/providers/cart-provider";
import { requestBackInStock, type ActionState } from "@/app/actions/product";
import { Price } from "@/components/ui/price";
import { WishlistButton } from "./wishlist-button";
import { pushRecentlyViewed } from "@/lib/recently-viewed";

interface Variant {
  id: string;
  name: string;
  price: number;
  stock: number;
}

export function AddToCart({
  productId,
  slug,
  name,
  variants,
  compareAtPrice,
  optionLabel,
}: {
  productId: string;
  slug: string;
  name: string;
  variants: Variant[];
  compareAtPrice: number | null;
  optionLabel: string;
}) {
  const { add } = useCart();
  const firstInStock = variants.find((v) => v.stock > 0) ?? variants[0]!;
  const [variantId, setVariantId] = useState(firstInStock.id);
  const [qty, setQty] = useState(1);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const v = variants.find((x) => x.id === variantId)!;
  const out = v.stock <= 0;
  const [alertState, alertAction, alertPending] = useActionState<ActionState, FormData>(requestBackInStock, null);

  useEffect(() => {
    pushRecentlyViewed(slug);
    const body = JSON.stringify({ type: "product_view", path: `/products/${slug}`, productId });
    navigator.sendBeacon?.("/api/analytics", new Blob([body], { type: "application/json" }));
  }, [slug, productId]);

  return (
    <div className="space-y-5">
      <Price price={v.price} compareAt={compareAtPrice && compareAtPrice > v.price ? compareAtPrice : null} className="text-2xl" />
      <p className="-mt-3 text-xs text-muted">Price includes VAT</p>

      {variants.length > 1 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">
            {optionLabel}: <span className="font-normal">{v.name}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((x) => (
              <label key={x.id} className={`cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500 ${x.id === variantId ? "border-brand-900 bg-brand-900 text-white" : "border-line hover:border-brand-900"} ${x.stock <= 0 ? "opacity-60 line-through decoration-1" : ""}`}>
                <input type="radio" name="variant" value={x.id} checked={x.id === variantId} onChange={() => { setVariantId(x.id); setQty(1); setStatus(null); }} className="sr-only" />
                {x.name}
                {x.stock <= 0 && <span className="sr-only"> (out of stock)</span>}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <p className={`text-sm font-semibold ${out ? "text-sale" : v.stock <= 5 ? "text-amber-700" : "text-brand-600"}`} aria-live="polite">
        {out ? "Out of stock" : v.stock <= 5 ? `Low stock — only ${v.stock} left` : "In stock, ready to ship"}
      </p>

      {!out ? (
        <div className="flex gap-3">
          <div className="inline-flex items-center rounded-lg border border-line">
            <button type="button" className="grid size-11 place-items-center disabled:opacity-40" onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1} aria-label="Decrease quantity">
              <Minus className="size-4" aria-hidden />
            </button>
            <label htmlFor="qty" className="sr-only">
              Quantity
            </label>
            <input id="qty" type="number" inputMode="numeric" min={1} max={Math.min(20, v.stock)} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(v.stock, 20, Number(e.target.value) || 1)))} className="w-12 [appearance:textfield] text-center text-sm font-semibold outline-none [&::-webkit-inner-spin-button]:appearance-none" />
            <button type="button" className="grid size-11 place-items-center disabled:opacity-40" onClick={() => setQty(Math.min(v.stock, 20, qty + 1))} disabled={qty >= Math.min(v.stock, 20)} aria-label="Increase quantity">
              <Plus className="size-4" aria-hidden />
            </button>
          </div>
          <button
            type="button"
            className="btn-primary flex-1 text-base"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const r = await add(variantId, qty);
              setStatus(r.error ? { ok: false, text: r.error } : { ok: true, text: "Added to your basket" });
              setBusy(false);
            }}
          >
            {busy ? "Adding…" : "Add to basket"}
          </button>
          <WishlistButton productId={productId} name={name} className="size-12" />
        </div>
      ) : (
        <form action={alertAction} className="rounded-lg border border-line p-4">
          <p className="text-sm font-semibold">Get an email when it&apos;s back in stock</p>
          <input type="hidden" name="variantId" value={variantId} />
          <div className="mt-2 flex gap-2">
            <label htmlFor="bis-email" className="sr-only">
              Email
            </label>
            <input id="bis-email" name="email" type="email" required placeholder="you@example.com" className="input" autoComplete="email" />
            <button className="btn-primary shrink-0" disabled={alertPending}>
              Notify me
            </button>
          </div>
          {alertState && <p role="status" className={`mt-2 text-xs ${alertState.ok ? "text-brand-600" : "text-sale"}`}>{alertState.message}</p>}
        </form>
      )}
      {status && (
        <p role="status" className={`flex items-center gap-1 text-sm ${status.ok ? "text-brand-600" : "text-sale"}`}>
          {status.ok && <Check className="size-4" aria-hidden />} {status.text}
        </p>
      )}
    </div>
  );
}
