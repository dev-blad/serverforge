import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";

export function Price({ price, compareAt, from, className }: { price: number; compareAt?: number | null; from?: boolean; className?: string }) {
  const onSale = compareAt != null && compareAt > price;
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-2", className)}>
      <span className={cn("font-semibold", onSale && "text-sale")}>
        {from && <span className="mr-1 text-xs font-normal text-muted">from</span>}
        {formatPrice(price)}
      </span>
      {onSale && (
        <>
          <span className="text-sm text-muted line-through">
            <span className="sr-only">Was </span>
            {formatPrice(compareAt)}
          </span>
          <span className="text-xs font-semibold text-sale">Save {formatPrice(compareAt - price)}</span>
        </>
      )}
    </span>
  );
}
