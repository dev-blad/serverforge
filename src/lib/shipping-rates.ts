export const FREE_SHIPPING_THRESHOLD = Number(process.env.NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD ?? 5000);

export type ShippingMethodId = "evri-48" | "rm-tracked48" | "rm-tracked24";

export interface ShippingMethod {
  id: ShippingMethodId;
  carrier: "Evri" | "Royal Mail";
  name: string;
  description: string;
  price: number;
  /** Becomes free once the (discounted) subtotal reaches FREE_SHIPPING_THRESHOLD */
  freeEligible: boolean;
  minDays: number;
  maxDays: number;
}

export const SHIPPING_METHODS: ShippingMethod[] = [
  {
    id: "rm-tracked48",
    carrier: "Royal Mail",
    name: "Royal Mail Tracked 48",
    description: "2–3 working days, tracked",
    price: 399,
    freeEligible: true,
    minDays: 2,
    maxDays: 3,
  },
  {
    id: "evri-48",
    carrier: "Evri",
    name: "Evri Standard",
    description: "2–4 working days, tracked",
    price: 349,
    freeEligible: true,
    minDays: 2,
    maxDays: 4,
  },
  {
    id: "rm-tracked24",
    carrier: "Royal Mail",
    name: "Royal Mail Tracked 24",
    description: "Next working day if ordered by 2pm",
    price: 599,
    freeEligible: false,
    minDays: 1,
    maxDays: 1,
  },
];

export const DEFAULT_SHIPPING_METHOD: ShippingMethodId = "rm-tracked48";

export function getShippingMethod(id: string | null | undefined): ShippingMethod {
  return SHIPPING_METHODS.find((m) => m.id === id) ?? SHIPPING_METHODS[0]!;
}

/** Add n UK working days (Mon–Fri) to a date. Bank holidays are not modelled. */
export function addWorkingDays(from: Date, days: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}
