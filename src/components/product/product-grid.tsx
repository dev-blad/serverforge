import type { ProductCardData } from "@/lib/catalog";
import { ProductCard } from "./product-card";

export function ProductGrid({ products, priorityCount = 0 }: { products: ProductCardData[]; priorityCount?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
      {products.map((p, i) => (
        <li key={p.id} className="flex">
          <div className="w-full">
            <ProductCard p={p} priority={i < priorityCount} />
          </div>
        </li>
      ))}
    </ul>
  );
}
