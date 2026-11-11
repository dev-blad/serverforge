import "server-only";
import { db } from "@/lib/db";
import { features } from "@/lib/config";
import { formatOrderNumber } from "@/lib/utils";
import { getShippingMethod, SHIPPING_METHODS } from "@/lib/shipping-rates";
import { getShippingProvider } from "./providers";
import { printPdf } from "./printnode";
import { renderPackingSlips, type SlipOrder } from "./pdf";
import type { LabelAddress, ParcelFormat } from "./types";

const LARGE = new Set(["rackets", "bags"]);
const LETTER = new Set(["grips-overgrips", "accessories", "protectors"]);

export function parcelFormatFor(categorySlugs: string[]): ParcelFormat {
  if (categorySlugs.some((c) => LARGE.has(c))) return "mediumParcel";
  if (categorySlugs.every((c) => LETTER.has(c))) return "largeLetter";
  return "smallParcel";
}

async function loadForFulfilment(orderId: string) {
  return db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: { include: { product: { include: { category: true } } } }, shipment: true },
  });
}

type FulfilmentOrder = Awaited<ReturnType<typeof loadForFulfilment>>;

export function toSlipOrder(o: Pick<FulfilmentOrder, "number" | "createdAt" | "email" | "shippingMethod" | "shippingAddress" | "customerNote" | "items" | "total">): SlipOrder {
  return {
    number: formatOrderNumber(o.number),
    createdAt: o.createdAt,
    email: o.email,
    shippingMethod: o.shippingMethod,
    shippingAddress: o.shippingAddress as unknown as LabelAddress,
    customerNote: o.customerNote,
    items: o.items.map((i) => ({ name: i.name, variantName: i.variantName, sku: i.sku, quantity: i.quantity, unitPrice: i.unitPrice })),
    total: o.total,
  };
}

/**
 * Create a shipping label for a paid order via the configured provider and
 * (optionally) send label + packing slip to the PrintNode printer.
 * Idempotent: an existing label is reused unless `force` is set.
 */
export async function createShipmentForOrder(orderId: string, opts: { force?: boolean; print?: boolean } = {}) {
  const order = await loadForFulfilment(orderId);
  const print = opts.print ?? features.autoPrint;
  const ref = formatOrderNumber(order.number);

  if (order.shipment?.labelPdf && !opts.force) return order.shipment;

  const provider = getShippingProvider();
  const methodId = SHIPPING_METHODS.find((m) => m.name === order.shippingMethod)?.id ?? getShippingMethod(null).id;
  const weight = 150 + order.items.reduce((s, i) => s + (i.product?.shippingWeight ?? 500) * i.quantity, 0);
  const addr = order.shippingAddress as unknown as LabelAddress;

  try {
    const label = await provider.createLabel({
      orderReference: ref,
      orderDate: order.createdAt,
      recipient: { ...addr, email: order.email, country: addr.country || "GB" },
      serviceId: methodId,
      weightGrams: weight,
      parcelFormat: parcelFormatFor(order.items.map((i) => i.product?.category.slug ?? "")),
      subtotal: order.subtotal - order.discountTotal,
      shipping: order.shippingTotal,
      total: order.total + order.giftCardTotal,
      items: order.items.map((i) => ({
        name: i.name,
        sku: i.sku,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        weightGrams: i.product?.shippingWeight ?? 500,
      })),
    });

    const shipment = await db.shipment.upsert({
      where: { orderId },
      create: {
        orderId,
        provider: label.provider,
        service: label.service,
        status: "LABEL_CREATED",
        trackingNumber: label.trackingNumber,
        trackingUrl: label.trackingUrl,
        labelPdf: label.labelPdf ? Buffer.from(label.labelPdf) : null,
      },
      update: {
        provider: label.provider,
        service: label.service,
        status: "LABEL_CREATED",
        trackingNumber: label.trackingNumber,
        trackingUrl: label.trackingUrl,
        labelPdf: label.labelPdf ? Buffer.from(label.labelPdf) : null,
        error: null,
      },
    });
    await db.order.update({
      where: { id: orderId },
      data: { trackingNumber: label.trackingNumber, trackingUrl: label.trackingUrl, carrier: label.carrier },
    });
    await db.orderEvent.create({
      data: { orderId, type: "label", message: `Label created via ${label.provider} (${label.service}) — ${label.trackingNumber}` },
    });

    if (print) return printShipmentDocs(orderId);
    return shipment;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.shipment.upsert({
      where: { orderId },
      create: { orderId, provider: provider.id, service: order.shippingMethod, status: "FAILED", error: message },
      update: { status: "FAILED", error: message },
    });
    await db.orderEvent.create({ data: { orderId, type: "error", message: `Label creation failed: ${message}` } });
    throw e;
  }
}

/** Send the label and packing slip for an order to PrintNode. */
export async function printShipmentDocs(orderId: string) {
  const order = await loadForFulfilment(orderId);
  const ref = formatOrderNumber(order.number);
  const shipment = order.shipment;
  if (!shipment?.labelPdf) throw new Error("No label to print — create a label first");

  const labelJob = await printPdf({ title: `Label ${ref}`, pdf: shipment.labelPdf, kind: "label" });
  const slip = await renderPackingSlips([toSlipOrder(order)]);
  const slipJob = await printPdf({ title: `Packing slip ${ref}`, pdf: slip, kind: "slip" });

  const ok = labelJob.ok && slipJob.ok;
  const stubbed = labelJob.stubbed;
  const updated = await db.shipment.update({
    where: { orderId },
    data: {
      status: ok ? (stubbed ? "LABEL_CREATED" : "PRINTED") : "PRINT_FAILED",
      printJobId: labelJob.jobId,
      printedAt: ok && !stubbed ? new Date() : null,
      error: ok ? null : (labelJob.error ?? slipJob.error),
    },
  });
  await db.orderEvent.create({
    data: {
      orderId,
      type: ok ? "print" : "error",
      message: stubbed
        ? "PrintNode not configured — label & packing slip ready to print from admin"
        : ok
          ? `Label (job ${labelJob.jobId}) and packing slip (job ${slipJob.jobId}) sent to printer`
          : `Printing failed: ${labelJob.error ?? slipJob.error}`,
    },
  });
  return updated;
}
