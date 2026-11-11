import { cn } from "@/lib/utils";

export function Stars({ rating, count, size = "sm", className }: { rating: number; count?: number; size?: "sm" | "md"; className?: string }) {
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
  const s = size === "md" ? "text-lg" : "text-sm";
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className={cn("relative inline-block leading-none tracking-[0.1em]", s)} aria-hidden>
        <span className="text-line">★★★★★</span>
        <span className="absolute inset-0 overflow-hidden whitespace-nowrap text-amber-500" style={{ width: `${pct}%` }}>
          ★★★★★
        </span>
      </span>
      <span className="sr-only">Rated {rating.toFixed(1)} out of 5</span>
      {count !== undefined && <span className="text-xs text-muted">({count}<span className="sr-only"> reviews</span>)</span>}
    </span>
  );
}
