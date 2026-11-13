"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

const KEY = "cl_wishlist";

interface WishlistContextValue {
  ids: string[];
  has: (productId: string) => boolean;
  toggle: (productId: string) => Promise<void>;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

function readLocal(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

/** Guests: localStorage. Signed-in users: synced to the database (local items are merged on sign-in). */
export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    setIds(readLocal());
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    void (async () => {
      const local = readLocal();
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merge: local }),
      });
      if (res.ok) {
        const data = (await res.json()) as { ids: string[] };
        setIds(data.ids);
        localStorage.setItem(KEY, JSON.stringify(data.ids));
      }
    })();
  }, [status]);

  const toggle = useCallback(
    async (productId: string) => {
      const next = ids.includes(productId) ? ids.filter((i) => i !== productId) : [productId, ...ids];
      setIds(next);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage may be unavailable */
      }
      if (status === "authenticated") {
        await fetch("/api/wishlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toggle: productId }),
        });
      }
    },
    [ids, status],
  );

  const value = useMemo(() => ({ ids, has: (id: string) => ids.includes(id), toggle }), [ids, toggle]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used inside WishlistProvider");
  return ctx;
}
