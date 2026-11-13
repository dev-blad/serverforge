"use client";

import { Heart } from "lucide-react";
import { useWishlist } from "@/components/providers/wishlist-provider";
import { cn } from "@/lib/utils";

export function WishlistButton({ productId, name, className }: { productId: string; name: string; className?: string }) {
  const { has, toggle } = useWishlist();
  const active = has(productId);
  return (
    <button
      type="button"
      onClick={() => void toggle(productId)}
      aria-pressed={active}
      aria-label={active ? `Remove ${name} from wishlist` : `Add ${name} to wishlist`}
      className={cn(
        "relative z-10 grid size-9 place-items-center rounded-full bg-white/95 shadow-sm ring-1 ring-line transition hover:scale-105",
        className,
      )}
    >
      <Heart className={cn("size-4", active ? "fill-sale text-sale" : "text-ink")} aria-hidden />
    </button>
  );
}
