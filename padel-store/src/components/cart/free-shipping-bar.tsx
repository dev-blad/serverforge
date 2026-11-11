import { FREE_SHIPPING_THRESHOLD } from "@/lib/shipping-rates";
import { formatPrice } from "@/lib/money";

export function FreeShippingBar({ remaining }: { remaining: number }) {
  const pct = Math.round(((FREE_SHIPPING_THRESHOLD - remaining) / FREE_SHIPPING_THRESHOLD) * 100);
  return (
    <div className="rounded-lg bg-brand-50 p-3">
      <p className="text-sm" aria-live="polite">
        {remaining > 0 ? (
          <>
            You&apos;re <strong>{formatPrice(remaining)}</strong> away from <strong>free UK delivery</strong>
          </>
        ) : (
          <>
            🎉 You&apos;ve unlocked <strong>free UK delivery</strong>
          </>
        )}
      </p>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-brand-100"
        role="progressbar"
        aria-label="Progress towards free delivery"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, pct)}
      >
        <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}
