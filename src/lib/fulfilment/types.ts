import type { ShippingMethodId } from "@/lib/shipping-rates";

export interface LabelAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  county?: string;
  postcode: string;
  country: string;
  phone?: string;
  email?: string;
}

export type ParcelFormat = "largeLetter" | "smallParcel" | "mediumParcel";

export interface LabelRequest {
  orderReference: string;
  orderDate: Date;
  recipient: LabelAddress;
  serviceId: ShippingMethodId;
  weightGrams: number;
  parcelFormat: ParcelFormat;
  subtotal: number;
  shipping: number;
  total: number;
  items: { name: string; sku: string; quantity: number; unitPrice: number; weightGrams: number }[];
}

export interface LabelResult {
  provider: string;
  carrier: string;
  service: string;
  trackingNumber: string;
  trackingUrl: string | null;
  /** PDF bytes, or null if the provider created the shipment but didn't return a label */
  labelPdf: Uint8Array | null;
  externalId?: string;
}

export interface ShippingProvider {
  id: "stub" | "royalmail" | "shipstation";
  createLabel(req: LabelRequest): Promise<LabelResult>;
}

export function trackingUrlFor(carrier: string, trackingNumber: string): string {
  if (/evri|hermes/i.test(carrier)) return `https://www.evri.com/track/parcel/${encodeURIComponent(trackingNumber)}`;
  return `https://www.royalmail.com/track-your-item#/tracking-results/${encodeURIComponent(trackingNumber)}`;
}
