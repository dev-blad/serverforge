"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CartDTO } from "@/lib/cart";

interface CartContextValue {
  cart: CartDTO | null;
  loading: boolean;
  open: boolean;
  setOpen: (v: boolean) => void;
  add: (variantId: string, quantity?: number, opts?: { openDrawer?: boolean }) => Promise<{ error?: string }>;
  update: (itemId: string, quantity: number) => Promise<void>;
  applyCode: (code: string) => Promise<{ error?: string; applied?: string }>;
  removeCode: (kind: "discount" | "giftcard") => Promise<void>;
  refresh: (shipping?: string) => Promise<void>;
  lastAdded: string | null;
}

const CartContext = createContext<CartContextValue | null>(null);

async function json<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? "Something went wrong");
  return body;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  const refresh = useCallback(async (shipping?: string) => {
    try {
      const res = await fetch(`/api/cart${shipping ? `?shipping=${shipping}` : ""}`, { cache: "no-store" });
      setCart(await json<CartDTO>(res));
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = useCallback<CartContextValue["add"]>(async (variantId, quantity = 1, opts) => {
    try {
      const res = await fetch("/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId, quantity }),
      });
      setCart(await json<CartDTO>(res));
      setLastAdded(variantId);
      if (opts?.openDrawer !== false) setOpen(true);
      return {};
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Could not add to basket" };
    }
  }, []);

  const update = useCallback(async (itemId: string, quantity: number) => {
    const res = await fetch("/api/cart/items", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, quantity }),
    });
    setCart(await json<CartDTO>(res).catch(() => cart));
  }, [cart]);

  const applyCode = useCallback(async (code: string) => {
    try {
      const res = await fetch("/api/cart/codes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const data = await json<CartDTO & { applied: string }>(res);
      setCart(data);
      return { applied: data.applied };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Invalid code" };
    }
  }, []);

  const removeCode = useCallback(async (kind: "discount" | "giftcard") => {
    const res = await fetch(`/api/cart/codes?kind=${kind}`, { method: "DELETE" });
    setCart(await json<CartDTO>(res));
  }, []);

  const value = useMemo(
    () => ({ cart, loading, open, setOpen, add, update, applyCode, removeCode, refresh, lastAdded }),
    [cart, loading, open, add, update, applyCode, removeCode, refresh, lastAdded],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
