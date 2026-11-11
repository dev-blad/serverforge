"use client";

import { useEffect, useState } from "react";
import type { ProductCardData } from "@/lib/catalog";
import { getRecentlyViewed } from "@/lib/recently-viewed";
import { ProductCard } from "./product-card";

export function RecentlyViewed({ exclude, title = "Recently viewed" }: { exclude?: string; title?: string }) {
  const [items, setItems] = useState<ProductCardData[]>([]);
  useEffect(() => {
    const slugs = getRecentlyViewed().filter((s) => s !== exclude).slice(0, 4);
    if (!slugs.length) return;
    void fetch(`/api/products/by-slugs?slugs=${slugs.join(",")}`)
      .then((r) => r.json() as Promise<{ items: ProductCardData[] }>)
      .then((d) => setItems(d.items));
  }, [exclude]);
  if (!items.length) return null;
  return (
    <section aria-labelledby="recent-title" className="container-page py-10">
      <h2 id="recent-title" className="mb-6 text-2xl font-extrabold">
        {title}
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {items.map((p) => (
          <li key={p.id}>
            <ProductCard p={p} />
          </li>
        ))}
      </ul>
    </section>
  );
}
