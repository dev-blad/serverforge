"use client";

import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useState } from "react";
import type { ProductCardData } from "@/lib/catalog";
import { useCart } from "@/components/providers/cart-provider";
import { formatPrice } from "@/lib/money";

export function FrequentlyBoughtTogether({ main, others }: { main: ProductCardData; others: ProductCardData[] }) {
  const { add } = useCart();
  const addable = others.filter((o) => o.defaultVariantId);
  const priceOf = (o: ProductCardData) => o.defaultVariantPrice;
  const [selected, setSelected] = useState<string[]>(addable.map((o) => o.id));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (!others.length) return null;
  const chosen = addable.filter((o) => selected.includes(o.id));
  const mainVariant = main.defaultVariantId;
  const total = (mainVariant ? priceOf(main) : 0) + chosen.reduce((s, o) => s + priceOf(o), 0);

  return (
    <section aria-labelledby="fbt-title" className="card p-5 sm:p-6">
      <h2 id="fbt-title" className="text-xl font-extrabold">
        Frequently bought together
      </h2>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {[main, ...others].map((p, i) => (
          <div key={p.id} className="flex items-center gap-3">
            {i > 0 && <Plus className="size-4 text-muted" aria-hidden />}
            <Link href={`/products/${p.slug}`} className="relative block size-20 overflow-hidden rounded-lg bg-canvas sm:size-24">
              <Image src={p.image} alt={p.name} fill sizes="96px" className="object-cover" unoptimized />
            </Link>
          </div>
        ))}
      </div>
      <ul className="mt-4 space-y-2">
        <li className="text-sm">
          <strong>This item:</strong> {main.name}{main.variantCount > 1 && main.defaultVariantName ? ` (${main.defaultVariantName})` : ""} — {formatPrice(priceOf(main))}
        </li>
        {others.map((o) => {
          const can = addable.includes(o);
          return (
            <li key={o.id} className="text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="size-4 accent-brand-900" disabled={!can} checked={can && selected.includes(o.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, o.id] : selected.filter((s) => s !== o.id))} />
                <span>
                  <Link href={`/products/${o.slug}`} className="hover:underline">{o.name}</Link>
                  {o.variantCount > 1 && o.defaultVariantName && <span className="text-muted"> ({o.defaultVariantName})</span>} — {formatPrice(priceOf(o))}
                  {!can && <span className="text-xs text-sale"> (out of stock)</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <p className="text-sm">
          Total: <strong className="text-base">{formatPrice(total)}</strong>
        </p>
        <button
          type="button"
          className="btn-primary"
          disabled={busy || (!chosen.length && !mainVariant)}
          onClick={async () => {
            setBusy(true);
            const ids = [...(mainVariant ? [mainVariant] : []), ...chosen.map((c) => c.defaultVariantId!)];
            for (const [i, id] of ids.entries()) await add(id, 1, { openDrawer: i === ids.length - 1 });
            setBusy(false);
            setMsg(`${ids.length} item${ids.length === 1 ? "" : "s"} added`);
          }}
        >
          {busy ? "Adding…" : `Add ${chosen.length + (mainVariant ? 1 : 0)} items to basket`}
        </button>
        {msg && <p role="status" className="text-sm text-brand-600">{msg}</p>}
      </div>
    </section>
  );
}
