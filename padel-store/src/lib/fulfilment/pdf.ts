import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { SHIPPING_FROM, store } from "@/lib/config";
import { formatPrice } from "@/lib/money";
import type { LabelAddress } from "./types";

const INK = rgb(0.08, 0.13, 0.11);

function text(page: PDFPage, s: string, x: number, y: number, font: PDFFont, size: number) {
  // pdf-lib standard fonts only support WinAnsi — strip anything else.
  const safe = s.replace(/[^\x20-\x7E£–—]/g, "").replace(/[–—]/g, "-");
  page.drawText(safe, { x, y, font, size, color: INK });
}

/** Simple Code-39-style barcode drawing (visual only for demo labels). */
function barcode(page: PDFPage, value: string, x: number, y: number, w: number, h: number) {
  const bits: number[] = [];
  for (const ch of value) {
    const c = ch.charCodeAt(0);
    for (let i = 0; i < 7; i++) bits.push((c >> i) & 1, 0);
    bits.push(0);
  }
  const unit = w / (bits.length + 4);
  let cx = x + unit * 2;
  for (const b of bits) {
    if (b) page.drawRectangle({ x: cx, y, width: unit * 1.4, height: h, color: INK });
    cx += unit;
  }
}

/** 4×6in (101.6×152.4mm) thermal-label-sized PDF used by the stub provider. */
export async function renderStubLabel(opts: {
  carrier: string;
  service: string;
  trackingNumber: string;
  orderReference: string;
  weightGrams: number;
  to: LabelAddress;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([288, 432]);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);

  page.drawRectangle({ x: 8, y: 8, width: 272, height: 416, borderColor: INK, borderWidth: 1.5 });
  page.drawRectangle({ x: 8, y: 372, width: 272, height: 52, color: INK });
  page.drawText(opts.carrier.toUpperCase(), { x: 18, y: 400, font: bold, size: 16, color: rgb(1, 1, 1) });
  page.drawText(opts.service, { x: 18, y: 382, font: reg, size: 10, color: rgb(1, 1, 1) });

  text(page, "DEMO LABEL - NOT VALID FOR POSTAGE", 18, 356, bold, 9);
  text(page, "DELIVER TO:", 18, 334, bold, 9);
  const to = [opts.to.name, opts.to.line1, opts.to.line2, opts.to.city, opts.to.county, opts.to.postcode].filter(Boolean) as string[];
  let y = 316;
  for (const [i, line] of to.entries()) {
    text(page, line, 18, y, i === to.length - 1 ? bold : reg, i === to.length - 1 ? 16 : 12);
    y -= i === to.length - 2 ? 20 : 15;
  }

  barcode(page, opts.trackingNumber, 18, 120, 252, 60);
  text(page, opts.trackingNumber, 70, 104, bold, 12);
  text(page, `Ref: ${opts.orderReference}   Weight: ${(opts.weightGrams / 1000).toFixed(2)}kg`, 18, 84, reg, 9);
  text(page, "FROM / RETURN TO:", 18, 64, bold, 8);
  text(page, `${SHIPPING_FROM.name}, ${SHIPPING_FROM.line1}`, 18, 52, reg, 8);
  text(page, `${SHIPPING_FROM.city} ${SHIPPING_FROM.postcode}`, 18, 41, reg, 8);
  text(page, new Date().toISOString().slice(0, 10), 220, 20, reg, 8);
  return doc.save();
}

export interface SlipOrder {
  number: string;
  createdAt: Date;
  email: string;
  shippingMethod: string;
  shippingAddress: LabelAddress;
  customerNote?: string | null;
  items: { name: string; variantName: string; sku: string; quantity: number; unitPrice: number }[];
  total: number;
}

/** A4 packing slip(s) — one page per order. */
export async function renderPackingSlips(orders: SlipOrder[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  for (const o of orders) {
    const page = doc.addPage([595.28, 841.89]);
    text(page, store.name, 40, 790, bold, 20);
    text(page, "PACKING SLIP", 420, 790, bold, 14);
    text(page, `Order ${o.number}`, 420, 772, reg, 11);
    text(page, o.createdAt.toISOString().slice(0, 10), 420, 758, reg, 10);
    text(page, "Ship to", 40, 740, bold, 11);
    const a = o.shippingAddress;
    let y = 724;
    for (const l of [a.name, a.line1, a.line2, a.city, a.county, a.postcode].filter(Boolean) as string[]) {
      text(page, l, 40, y, reg, 11);
      y -= 14;
    }
    text(page, `Service: ${o.shippingMethod}`, 320, 724, reg, 10);
    text(page, `Customer: ${o.email}`, 320, 710, reg, 10);

    y = 620;
    page.drawRectangle({ x: 40, y: y - 6, width: 515, height: 22, color: rgb(0.93, 0.95, 0.92) });
    text(page, "Packed", 46, y, bold, 10);
    text(page, "Qty", 100, y, bold, 10);
    text(page, "Item", 140, y, bold, 10);
    text(page, "SKU", 400, y, bold, 10);
    y -= 28;
    for (const it of o.items) {
      page.drawRectangle({ x: 52, y: y - 2, width: 11, height: 11, borderColor: INK, borderWidth: 1 });
      text(page, String(it.quantity), 104, y, bold, 11);
      text(page, it.name.slice(0, 44), 140, y, reg, 10);
      text(page, it.variantName.slice(0, 44), 140, y - 12, reg, 8);
      text(page, it.sku, 400, y, reg, 9);
      y -= 32;
    }
    if (o.customerNote) {
      text(page, "Customer note:", 40, y - 10, bold, 10);
      text(page, o.customerNote.slice(0, 100), 40, y - 24, reg, 10);
    }
    text(page, `Order value ${formatPrice(o.total)}`, 40, 110, reg, 10);
    text(page, "Thanks for shopping with us! Returns: 14 days from delivery - see our website/policies/returns", 40, 80, reg, 9);
    text(page, `${store.companyName} - ${store.address}`, 40, 64, reg, 8);
  }
  return doc.save();
}
