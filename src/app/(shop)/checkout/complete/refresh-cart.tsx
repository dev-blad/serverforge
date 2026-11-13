"use client";

import { useEffect } from "react";
import { useCart } from "@/components/providers/cart-provider";

export function RefreshCart() {
  const { refresh } = useCart();
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return null;
}
