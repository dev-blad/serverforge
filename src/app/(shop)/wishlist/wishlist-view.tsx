"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useWishlist } from "@/components/providers/wishlist-provider";
import type { ProductCardData } from "@/lib/catalog";
import { ProductCard } from "@/components/product/product-card";

export function WishlistView() {
  const { ids } = useWishlist();
  const { status } = useSession();
  const [items, setItems] = useState<ProductCardData[] | null>(null);
  useEffect(() => {
    if (!ids.length) {
      setItems([]);
      return;
    }
    void fetch(`/api/products/by-slugs?ids=${ids.join(",")}`)
      .then((r) => r.json() as Promise<{ items: ProductCardData[] }>)
      .then((d) => setItems(d.items));
  }, [ids]);
  return (
    <>
      {status !== "authenticated" && (
        <p className="mt-2 text-sm text-muted">
          Saved on this device. <Link href="/account/login?callbackUrl=/wishlist" className="font-semibold text-brand-700 underline">Sign in</Link> to keep your wishlist across devices.
        </p>
      )}
      {items === null ? (
        <p className="mt-6 text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <div className="card mt-6 p-10 text-center">
          <p className="font-semibold">Nothing saved yet</p>
          <p className="mt-1 text-sm text-muted">Tap the heart on any product to save it here.</p>
          <Link href="/c/rackets" className="btn-primary mt-5">Browse rackets</Link>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {items.map((p) => (
            <li key={p.id}><ProductCard p={p} /></li>
          ))}
        </ul>
      )}
    </>
  );
}
