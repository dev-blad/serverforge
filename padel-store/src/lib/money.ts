const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

/** Format integer pence as GBP, e.g. 12999 -> "£129.99". */
export function formatPrice(pence: number): string {
  return gbp.format(pence / 100);
}

/** UK standard VAT rate. */
export const VAT_RATE = 0.2;

/** VAT contained within a VAT-inclusive amount (rounded to the penny). */
export function vatFromInclusive(pence: number): number {
  return Math.round(pence - pence / (1 + VAT_RATE));
}

/** Parse a "12.34" string into pence. Returns NaN for invalid input. */
export function poundsToPence(value: string | number): number {
  const n = typeof value === "number" ? value : Number.parseFloat(value.replace(/[£,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : Number.NaN;
}
