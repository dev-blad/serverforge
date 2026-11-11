import Image from "next/image";
import Link from "next/link";
import type { ProductCardData } from "@/lib/catalog";
import { Price } from "@/components/ui/price";
import { Stars } from "@/components/ui/stars";
import { WishlistButton } from "./wishlist-button";
import { QuickAdd } from "./quick-add";

export function ProductCard({ p, priority = false }: { p: ProductCardData; priority?: boolean }) {
  const outOfStock = p.totalStock <= 0;
  const low = !outOfStock && p.totalStock <= 5;
  const onSale = p.compareAtPrice != null && p.compareAtPrice > p.price;
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-line bg-white transition hover:shadow-[var(--shadow-card)]">
      <div className="relative aspect-square overflow-hidden bg-canvas">
        <Link href={`/products/${p.slug}`} tabIndex={-1} aria-hidden className="absolute inset-0">
          <Image
            src={p.image}
            alt=""
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
            priority={priority}
            unoptimized
          />
        </Link>
        <div className="pointer-events-none absolute top-2 left-2 flex flex-col gap-1">
          {onSale && <span className="badge bg-sale text-white">Sale</span>}
          {p.isNew && <span className="badge bg-brand-900 text-lime-accent">New</span>}
          {p.isBestSeller && !p.isNew && <span className="badge bg-white/95 text-brand-900 ring-1 ring-line">Best seller</span>}
        </div>
        <div className="absolute top-2 right-2">
          <WishlistButton productId={p.id} name={p.name} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
        {p.brand && <p className="text-xs font-medium tracking-wide text-muted uppercase">{p.brand}</p>}
        <h3 className="text-sm leading-snug font-semibold sm:text-[15px]">
          <Link href={`/products/${p.slug}`} className="after:absolute after:inset-0 after:content-[''] focus:outline-none">
            {p.name}
          </Link>
        </h3>
        {p.ratingCount > 0 && <Stars rating={p.ratingAvg} count={p.ratingCount} />}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <Price price={p.price} compareAt={p.compareAtPrice} from={p.variantCount > 1} className="text-[15px]" />
        </div>
        <p className={`text-xs ${outOfStock ? "text-sale" : low ? "text-amber-700" : "text-brand-600"}`}>
          {outOfStock ? "Out of stock" : low ? `Only ${p.totalStock} left` : "In stock — ships today"}
        </p>
        {p.singleVariantId && !outOfStock && (
          <div className="relative z-10 pt-2">
            <QuickAdd variantId={p.singleVariantId} name={p.name} />
          </div>
        )}
      </div>
    </article>
  );
}
