"use client";

import { useState } from "react";
import { useCart } from "@/components/providers/cart-provider";

export function QuickAdd({ variantId, name }: { variantId: string; name: string }) {
  const { add } = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={busy}
        className="btn-outline btn-sm w-full"
        onClick={async () => {
          setBusy(true);
          const r = await add(variantId, 1);
          setError(r.error ?? null);
          setBusy(false);
        }}
      >
        {busy ? "Adding…" : "Add to basket"}
        <span className="sr-only"> — {name}</span>
      </button>
      {error && <p role="alert" className="mt-1 text-xs text-sale">{error}</p>}
    </>
  );
}
