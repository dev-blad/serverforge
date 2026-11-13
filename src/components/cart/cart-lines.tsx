"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/components/providers/cart-provider";
import type { CartLine } from "@/lib/cart";
import { formatPrice } from "@/lib/money";

export function CartLines({ items, compact = false }: { items: CartLine[]; compact?: boolean }) {
  const { update } = useCart();
  const [busy, setBusy] = useState<string | null>(null);
  const change = async (id: string, q: number) => {
    setBusy(id);
    await update(id, q);
    setBusy(null);
  };
  return (
    <ul className="divide-y divide-line">
      {items.map((i) => (
        <li key={i.id} className="flex gap-3 py-4" aria-busy={busy === i.id}>
          <Link href={`/products/${i.slug}`} className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-canvas">
            {i.image && <Image src={i.image} alt="" fill sizes="80px" className="object-cover" unoptimized />}
          </Link>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex justify-between gap-2">
              <Link href={`/products/${i.slug}`} className="text-sm font-semibold hover:underline">
                {i.name}
              </Link>
              <span className="text-sm font-semibold">{formatPrice(i.lineTotal)}</span>
            </div>
            <span className="text-xs text-muted">
              {i.variantName}
              {!compact && <> · {formatPrice(i.unitPrice)} each</>}
            </span>
            {i.quantity > i.stock && <span className="text-xs text-sale">Only {i.stock} available</span>}
            <div className="mt-auto flex items-center gap-2 pt-2">
              <div className="inline-flex items-center rounded-lg border border-line">
                <button type="button" className="grid size-8 place-items-center disabled:opacity-40" onClick={() => change(i.id, i.quantity - 1)} disabled={busy === i.id} aria-label={`Decrease quantity of ${i.name}`}>
                  <Minus className="size-3.5" aria-hidden />
                </button>
                <span className="w-8 text-center text-sm" aria-live="polite" aria-label={`Quantity ${i.quantity}`}>
                  {i.quantity}
                </span>
                <button type="button" className="grid size-8 place-items-center disabled:opacity-40" onClick={() => change(i.id, i.quantity + 1)} disabled={busy === i.id || i.quantity >= i.stock} aria-label={`Increase quantity of ${i.name}`}>
                  <Plus className="size-3.5" aria-hidden />
                </button>
              </div>
              <button type="button" onClick={() => change(i.id, 0)} className="ml-auto inline-flex items-center gap-1 text-xs text-muted hover:text-sale" aria-label={`Remove ${i.name}`}>
                <Trash2 className="size-3.5" aria-hidden /> Remove
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
