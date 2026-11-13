"use client";

import { SessionProvider } from "next-auth/react";
import { CartProvider } from "./cart-provider";
import { ConsentProvider } from "./consent-provider";
import { WishlistProvider } from "./wishlist-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <ConsentProvider>
        <CartProvider>
          <WishlistProvider>{children}</WishlistProvider>
        </CartProvider>
      </ConsentProvider>
    </SessionProvider>
  );
}
