"use client";

import Link from "next/link";
import { Heart, ShoppingBag, User } from "lucide-react";
import { useSession } from "next-auth/react";
import { useCart } from "@/components/providers/cart-provider";
import { useWishlist } from "@/components/providers/wishlist-provider";

export function HeaderActions() {
  const { cart, setOpen } = useCart();
  const { ids } = useWishlist();
  const { data: session } = useSession();
  const count = cart?.itemCount ?? 0;
  return (
    <div className="flex items-center gap-1">
      {session?.user?.role === "ADMIN" && (
        <Link href="/admin" className="hidden rounded-lg bg-brand-900 px-3 py-1.5 text-xs font-semibold text-white sm:inline-block">
          Admin
        </Link>
      )}
      <Link href="/account" className="grid size-10 place-items-center rounded-lg hover:bg-canvas" aria-label={session ? "My account" : "Sign in"}>
        <User className="size-5" aria-hidden />
      </Link>
      <Link href="/wishlist" className="relative hidden size-10 place-items-center rounded-lg hover:bg-canvas sm:grid" aria-label={`Wishlist, ${ids.length} items`}>
        <Heart className="size-5" aria-hidden />
        {ids.length > 0 && <span className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-brand-900 text-[10px] font-bold text-white">{ids.length}</span>}
      </Link>
      <button type="button" onClick={() => setOpen(true)} className="relative grid size-10 place-items-center rounded-lg hover:bg-canvas" aria-label={`Basket, ${count} items`}>
        <ShoppingBag className="size-5" aria-hidden />
        {count > 0 && <span className="absolute top-1 right-0.5 grid min-w-4 place-items-center rounded-full bg-lime-strong px-1 text-[10px] font-bold text-brand-950">{count}</span>}
      </button>
    </div>
  );
}
