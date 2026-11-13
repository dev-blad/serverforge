import { vatFromInclusive } from "./money";
import { FREE_SHIPPING_THRESHOLD, getShippingMethod } from "./shipping-rates";

export interface PricedLine {
  unitPrice: number;
  quantity: number;
}

export interface DiscountLike {
  code: string;
  type: "PERCENT" | "FIXED" | "FREE_SHIPPING";
  value: number;
  minSubtotal: number;
  startsAt: Date | null;
  endsAt: Date | null;
  usageLimit: number | null;
  usageCount: number;
  active: boolean;
}

export interface GiftCardLike {
  code: string;
  balance: number;
  active: boolean;
  expiresAt: Date | null;
}

export type ValidationResult = { ok: true } | { ok: false; reason: string };

export function validateDiscount(d: DiscountLike | null, subtotal: number, now = new Date()): ValidationResult {
  if (!d || !d.active) return { ok: false, reason: "That code isn't valid." };
  if (d.startsAt && d.startsAt > now) return { ok: false, reason: "That code isn't active yet." };
  if (d.endsAt && d.endsAt < now) return { ok: false, reason: "That code has expired." };
  if (d.usageLimit !== null && d.usageCount >= d.usageLimit)
    return { ok: false, reason: "That code has reached its usage limit." };
  if (subtotal < d.minSubtotal)
    return { ok: false, reason: `Spend £${(d.minSubtotal / 100).toFixed(2)} or more to use this code.` };
  return { ok: true };
}

export function validateGiftCard(g: GiftCardLike | null, now = new Date()): ValidationResult {
  if (!g || !g.active) return { ok: false, reason: "That gift card isn't valid." };
  if (g.expiresAt && g.expiresAt < now) return { ok: false, reason: "That gift card has expired." };
  if (g.balance <= 0) return { ok: false, reason: "That gift card has no remaining balance." };
  return { ok: true };
}

export interface Totals {
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  /** Shipping before any free-shipping benefit (for "you saved" messaging) */
  shippingBeforeDiscount: number;
  giftCardTotal: number;
  taxTotal: number;
  total: number;
  freeShippingRemaining: number;
  qualifiesForFreeShipping: boolean;
}

/**
 * Compute order totals. All amounts in pence, VAT inclusive.
 * Gift cards are treated as a means of payment (multi-purpose voucher), so VAT is
 * calculated on goods + shipping *before* the gift card is applied.
 */
export function computeTotals(input: {
  lines: PricedLine[];
  shippingMethodId?: string | null;
  discount?: DiscountLike | null;
  giftCard?: GiftCardLike | null;
  now?: Date;
}): Totals {
  const now = input.now ?? new Date();
  const subtotal = input.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);

  let discountTotal = 0;
  let freeShippingCode = false;
  const d = input.discount ?? null;
  if (d && validateDiscount(d, subtotal, now).ok) {
    if (d.type === "PERCENT") discountTotal = Math.round((subtotal * Math.min(100, Math.max(0, d.value))) / 100);
    else if (d.type === "FIXED") discountTotal = Math.min(d.value, subtotal);
    else freeShippingCode = true;
  }

  const discounted = subtotal - discountTotal;
  const method = getShippingMethod(input.shippingMethodId);
  const qualifiesForFreeShipping = discounted >= FREE_SHIPPING_THRESHOLD;
  const shippingBeforeDiscount = subtotal === 0 ? 0 : method.price;
  let shippingTotal = shippingBeforeDiscount;
  if (freeShippingCode || (method.freeEligible && qualifiesForFreeShipping)) shippingTotal = 0;

  const beforeGiftCard = discounted + shippingTotal;
  const g = input.giftCard ?? null;
  const giftCardTotal = g && validateGiftCard(g, now).ok ? Math.min(g.balance, beforeGiftCard) : 0;

  return {
    subtotal,
    discountTotal,
    shippingTotal,
    shippingBeforeDiscount,
    giftCardTotal,
    taxTotal: vatFromInclusive(beforeGiftCard),
    total: beforeGiftCard - giftCardTotal,
    freeShippingRemaining: Math.max(0, FREE_SHIPPING_THRESHOLD - discounted),
    qualifiesForFreeShipping,
  };
}
